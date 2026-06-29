import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { geoNaturalEarth1, geoPath, geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { countryName, COUNTRY_CENTROID_FALLBACK } from "@/lib/geo/countries";

/**
 * WorldMap — a self-contained, client-only world map drawn with d3-geo.
 *
 * Mounted via next/dynamic({ ssr: false }) (geojson fetch + projection run
 * client-side). It fetches the bundled, simplified country backdrop from
 * /geo/world-countries.geo.json once, builds a Natural Earth projection fit to
 * a fixed viewBox, and paints:
 *   • country paths — a subtle cream backdrop so the map reads as a globe
 *   • country bubbles — gold circles at each country's centroid, sized by
 *     √(sessions); top ~6 labelled. Bubbles (not a choropleth) because early
 *     global traffic is sparse and a near-empty choropleth reads as broken.
 *
 * Country match is on `properties.a2` (ISO 3166-1 alpha-2), which is exactly
 * what the API's byCountry[].code and Vercel's x-vercel-ip-country return.
 */

const VB_W = 900;
const VB_H = 460;
const TOP_LABELS = 6;

export interface WorldMapCountry {
  code: string;
  count: number;
}

interface WorldMapProps {
  countries: WorldMapCountry[];
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  count: number;
}

// Module-level cache so toggling World⇄Canada (which unmounts this component)
// doesn't re-fetch and re-parse the 150KB backdrop every time — the parsed
// FeatureCollection is reused across mounts; only the first mount hits network.
let worldGeoCache: FeatureCollection | null = null;
let worldGeoPromise: Promise<FeatureCollection> | null = null;
function loadWorldGeo(): Promise<FeatureCollection> {
  if (worldGeoCache) return Promise.resolve(worldGeoCache);
  if (!worldGeoPromise) {
    worldGeoPromise = fetch("/geo/world-countries.geo.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: FeatureCollection) => {
        worldGeoCache = data;
        return data;
      })
      .catch((e) => {
        worldGeoPromise = null; // allow a retry on the next mount
        throw e;
      });
  }
  return worldGeoPromise;
}

export default function WorldMap({ countries }: WorldMapProps) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language?.startsWith("ko") ? "ko" : "en";
  const unit = t("admin.geography.map.unitSessions", "세션");
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorldGeo()
      .then((data) => {
        if (!cancelled) setGeo(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) m.set(c.code.toUpperCase(), c.count);
    return m;
  }, [countries]);

  const maxCount = useMemo(
    () => countries.reduce((mx, c) => Math.max(mx, c.count), 0),
    [countries],
  );

  const { path, projection } = useMemo(() => {
    if (!geo) return { path: null, projection: null };
    const proj = geoNaturalEarth1().fitSize([VB_W, VB_H], geo);
    return { path: geoPath(proj), projection: proj };
  }, [geo]);

  // Each country with sessions → a projected centroid bubble, biggest last so
  // smaller bubbles aren't hidden behind larger ones. Centroids are computed
  // from the geojson (no centroid table needed).
  const bubbles = useMemo(() => {
    if (!geo || !projection) return [];
    const out: Array<{ code: string; name: string; count: number; x: number; y: number }> = [];
    const placed = new Set<string>();
    // 1) Centroids derived from the geojson features that have sessions.
    for (const f of geo.features as Feature<Geometry, { a2?: string; name?: string }>[]) {
      const code = f.properties?.a2;
      if (!code) continue;
      const up = code.toUpperCase();
      const count = countByCode.get(up);
      if (!count) continue;
      const xy = projection(geoCentroid(f));
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
      out.push({ code: up, name: countryName(up, lang, f.properties?.name), count, x: xy[0], y: xy[1] });
      placed.add(up);
    }
    // 2) Fallback centroids for countries with sessions but no geojson feature
    //    (micro-states the 110m map omits) so they still get a bubble.
    for (const c of countries) {
      const up = c.code.toUpperCase();
      if (placed.has(up)) continue;
      const fb = COUNTRY_CENTROID_FALLBACK[up];
      if (!fb) continue;
      const xy = projection(fb);
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
      out.push({ code: up, name: countryName(up, lang), count: c.count, x: xy[0], y: xy[1] });
      placed.add(up);
    }
    return out.sort((a, b) => b.count - a.count);
  }, [geo, projection, countByCode, countries, lang]);

  // Greedily pick up to TOP_LABELS labels, skipping any whose anchor is too
  // close to an already-placed one — avoids unreadable overlap when the top
  // countries cluster (e.g. several European countries near each other).
  const labelBubbles = useMemo(() => {
    const placed: Array<{ x: number; y: number }> = [];
    const out: typeof bubbles = [];
    for (const b of bubbles) {
      if (placed.some((p) => Math.abs(p.x - b.x) < 46 && Math.abs(p.y - b.y) < 11)) continue;
      placed.push({ x: b.x, y: b.y });
      out.push(b);
      if (out.length >= TOP_LABELS) break;
    }
    return out;
  }, [bubbles]);

  function showTip(e: { clientX: number; clientY: number }, label: string, count: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {
      setTip({ x: 0, y: 0, label, count });
      return;
    }
    // Clamp x so the centered tooltip stays inside the map rather than clipping
    // off the left/right edge (worst near edge countries / on mobile).
    const x = Math.min(rect.width - 56, Math.max(56, e.clientX - rect.left));
    setTip({ x, y: e.clientY - rect.top, label, count });
  }

  function radiusFor(count: number): number {
    if (maxCount <= 0) return 4;
    return Math.min(22, 4 + Math.sqrt(count / maxCount) * 16);
  }

  if (!geo && !failed) {
    return (
      <div className="w-full aspect-[900/460] rounded-sm bg-cream-100 border border-cream-200 animate-pulse flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-400">
          {t("admin.geography.map.loading", "지도 불러오는 중…")}
        </span>
      </div>
    );
  }

  if (failed || !geo || !path || !projection) {
    return (
      <div className="w-full aspect-[900/460] rounded-sm bg-cream-100 border border-cream-200 flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-400">
          {t("admin.geography.map.failed", "지도를 불러올 수 없습니다")}
        </span>
      </div>
    );
  }

  const features = (geo.features ?? []) as Feature<Geometry, { a2?: string; name?: string }>[];

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={t("admin.geography.worldMap.ariaLabel", "전 세계 국가별 세션 분포 지도")}
      >
        {/* Country backdrop */}
        <g>
          {features.map((f, i) => {
            const d = path(f);
            if (!d) return null;
            return (
              <path
                key={f.properties?.a2 || f.properties?.name || i}
                d={d}
                fill="#f0eeea"
                stroke="#e5e2dc"
                strokeWidth={0.4}
              />
            );
          })}
        </g>

        {/* Session bubbles (one per country with data) */}
        <g>
          {bubbles.map((b, i) => {
            const r = radiusFor(b.count);
            return (
              <circle
                key={`${b.code}-${i}`}
                cx={b.x}
                cy={b.y}
                r={r}
                fill="#c49a3a"
                fillOpacity={0.55}
                stroke="#a8812e"
                strokeWidth={1}
                tabIndex={0}
                className="cursor-pointer outline-none transition-opacity duration-200 motion-reduce:transition-none hover:opacity-90 focus-visible:opacity-90"
                onMouseMove={(e) => showTip(e, b.name, b.count)}
                onMouseLeave={() => setTip(null)}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  showTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, b.name, b.count);
                }}
                onBlur={() => setTip(null)}
              >
                <title>{`${b.name} · ${b.count.toLocaleString()} ${unit}`}</title>
              </circle>
            );
          })}
        </g>

        {/* Top-country labels — drawn last so they sit above bubbles */}
        <g className="pointer-events-none">
          {labelBubbles.map((b, i) => (
            <text
              key={`label-${b.code}-${i}`}
              x={b.x + radiusFor(b.count) + 3}
              y={b.y + 3}
              className="font-mono"
              fontSize={9}
              fill="#0f1729"
              stroke="#fefefe"
              strokeWidth={2.5}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {b.name}
            </text>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-sm border border-forest-700 bg-forest-800 px-2.5 py-1.5 shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-body text-[12px] font-semibold leading-tight text-cream-100">
            {tip.label}
          </div>
          <div className="font-mono text-[10px] text-amber-300">
            {tip.count.toLocaleString()} {unit}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
          {t("admin.geography.map.legendSessions", "세션")}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-sage-500">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#c49a3a", opacity: 0.55, border: "1px solid #a8812e" }}
          />
          {t("admin.geography.worldMap.legendCountry", "국가")}
        </span>
      </div>
    </div>
  );
}
