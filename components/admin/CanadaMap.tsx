import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { usePanZoom } from "@/components/admin/usePanZoom";
import MapControls from "@/components/admin/MapControls";

/**
 * CanadaMap — a self-contained, client-only choropleth of Canadian provinces
 * with city bubbles, drawn with d3-geo (no react-simple-maps).
 *
 * The page mounts this via next/dynamic({ ssr: false }) because both the
 * geojson fetch and the d3 projection math run client-side. It fetches the
 * bundled FeatureCollection from /geo/canada-provinces.geo.json once, builds a
 * Mercator projection fit to a fixed 800x600 viewBox (resolution-independent),
 * and paints:
 *   • province paths — sequential cream→sage→forest ramp by session count
 *   • city circles   — amber bubbles sized by √(count), top ~6 labelled
 *   • a gradient legend + hover/focus tooltip
 *
 * Province name match is on `properties.name` (e.g. "Ontario"), which is what
 * the API's `byProvince[].name` already returns.
 */

const VB_W = 800;
const VB_H = 600;

export interface CanadaMapProvince {
  name: string;
  count: number;
}

export interface CanadaMapCity {
  city: string;
  province: string;
  lat: number | null;
  lng: number | null;
  count: number;
}

interface CanadaMapProps {
  provinces: CanadaMapProvince[];
  cities: CanadaMapCity[];
}

// ── Choropleth ramp (Midnight & Gold tokens) ───────────────────
// 0 sessions → very light cream; otherwise a sequential ramp from light
// cream through slate (sage) into deep forest by count / maxCount.
const EMPTY_FILL = "#f8f7f4"; // cream-100
const RAMP: Array<{ at: number; hex: string }> = [
  { at: 0, hex: "#f0eeea" }, // cream-200
  { at: 0.33, hex: "#9ea6bd" }, // sage-300
  { at: 0.66, hex: "#2e3d68" }, // forest-600
  { at: 1, hex: "#0f1729" }, // forest-800
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Color along the ramp for a normalized t in [0,1]. */
function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < RAMP.length - 1; i++) {
    const lo = RAMP[i];
    const hi = RAMP[i + 1];
    if (clamped <= hi.at) {
      const span = hi.at - lo.at || 1;
      return lerpHex(lo.hex, hi.hex, (clamped - lo.at) / span);
    }
  }
  return RAMP[RAMP.length - 1].hex;
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  count: number;
}

// Module-level cache so toggling World⇄Canada (which unmounts this component)
// doesn't re-fetch and re-parse the backdrop every time — the parsed
// FeatureCollection is reused across mounts; only the first mount hits network.
let canadaGeoCache: FeatureCollection | null = null;
let canadaGeoPromise: Promise<FeatureCollection> | null = null;
function loadCanadaGeo(): Promise<FeatureCollection> {
  if (canadaGeoCache) return Promise.resolve(canadaGeoCache);
  if (!canadaGeoPromise) {
    canadaGeoPromise = fetch("/geo/canada-provinces.geo.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: FeatureCollection) => {
        canadaGeoCache = data;
        return data;
      })
      .catch((e) => {
        canadaGeoPromise = null; // allow a retry on the next mount
        throw e;
      });
  }
  return canadaGeoPromise;
}

export default function CanadaMap({ provinces, cities }: CanadaMapProps) {
  const { t } = useTranslation("common");
  const unit = t("admin.geography.map.unitSessions", "세션");
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pz = usePanZoom(svgRef, VB_W, VB_H);

  useEffect(() => {
    let cancelled = false;
    loadCanadaGeo()
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

  const countByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of provinces) m.set(p.name, p.count);
    return m;
  }, [provinces]);

  const maxProvince = useMemo(
    () => provinces.reduce((mx, p) => Math.max(mx, p.count), 0),
    [provinces],
  );

  const drawableCities = useMemo(
    () =>
      cities
        .filter(
          (c): c is CanadaMapCity & { lat: number; lng: number } =>
            Number.isFinite(c.lat) && Number.isFinite(c.lng),
        )
        .sort((a, b) => b.count - a.count),
    [cities],
  );

  const maxCity = useMemo(
    () => drawableCities.reduce((mx, c) => Math.max(mx, c.count), 0),
    [drawableCities],
  );

  // Projection + path are derived once the geojson lands.
  const { path, projection } = useMemo(() => {
    if (!geo) return { path: null, projection: null };
    const proj = geoMercator().fitSize([VB_W, VB_H], geo);
    return { path: geoPath(proj), projection: proj };
  }, [geo]);

  function showTip(e: { clientX: number; clientY: number }, label: string, count: number) {
    if (pz.panning) return; // don't flicker tooltips mid-drag
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {
      setTip({ x: 0, y: 0, label, count });
      return;
    }
    // Clamp x so the centered tooltip stays inside the map rather than clipping
    // off the left/right edge.
    const x = Math.min(rect.width - 56, Math.max(56, e.clientX - rect.left));
    setTip({ x, y: e.clientY - rect.top, label, count });
  }

  function radiusFor(count: number): number {
    if (maxCity <= 0) return 3;
    return Math.min(18, 3 + Math.sqrt(count / maxCity) * 14);
  }

  const k = pz.k;

  // Project every city once. Markers are kept a constant SCREEN size (radius/k)
  // so a dense cluster (e.g. Toronto + Richmond Hill + Markham) separates as you
  // zoom in instead of merging into one blob.
  const cityPoints = useMemo(() => {
    if (!projection) return [] as Array<{ city: string; count: number; x: number; y: number }>;
    const out: Array<{ city: string; count: number; x: number; y: number }> = [];
    for (const c of drawableCities) {
      const xy = projection([c.lng, c.lat]);
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
      out.push({ city: c.city, count: c.count, x: xy[0], y: xy[1] });
    }
    return out;
  }, [drawableCities, projection]);

  // City labels appear progressively while zooming: the gap is a fixed screen
  // distance, so dividing by k lets more (closer-together) cities get a label
  // the further you drill into a region.
  const cityLabels = useMemo(() => {
    const gap = 26 / k;
    const placed: Array<{ x: number; y: number }> = [];
    const out: typeof cityPoints = [];
    for (const p of cityPoints) {
      if (placed.some((q) => Math.abs(q.x - p.x) < gap && Math.abs(q.y - p.y) < gap * 0.5)) continue;
      placed.push({ x: p.x, y: p.y });
      out.push(p);
      if (out.length >= 16) break;
    }
    return out;
  }, [cityPoints, k]);

  // ── Loading skeleton (geojson not fetched yet) ───────────────
  if (!geo && !failed) {
    return (
      <div className="w-full aspect-[4/3] rounded-sm bg-cream-100 border border-cream-200 animate-pulse flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-400">
          {t("admin.geography.map.loading", "지도 불러오는 중…")}
        </span>
      </div>
    );
  }

  if (failed || !geo || !path || !projection) {
    return (
      <div className="w-full aspect-[4/3] rounded-sm bg-cream-100 border border-cream-200 flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-400">
          {t("admin.geography.map.failed", "지도를 불러올 수 없습니다")}
        </span>
      </div>
    );
  }

  const features = (geo.features ?? []) as Feature<Geometry, { name?: string }>[];

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Resizable, draggable, zoomable map frame. */}
      <div
        className="relative w-full aspect-[4/3] resize overflow-hidden rounded-sm border border-cream-200 bg-cream-50"
        style={{ minHeight: 200, minWidth: 240, maxWidth: "100%" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full touch-none select-none"
          style={{ cursor: pz.panning ? "grabbing" : "grab" }}
          role="img"
          aria-label={t("admin.geography.map.ariaLabel", "캐나다 주별 세션 분포 지도")}
          {...pz.bind}
        >
          <g transform={pz.transform}>
            {/* Choropleth provinces */}
            <g>
              {features.map((f, i) => {
                const d = path(f);
                if (!d) return null;
                const name = f.properties?.name ?? "";
                const count = countByName.get(name) ?? 0;
                const fill =
                  count <= 0 ? EMPTY_FILL : rampColor(maxProvince > 0 ? count / maxProvince : 0);
                return (
                  <path
                    key={name || i}
                    d={d}
                    fill={fill}
                    stroke="#e5e2dc"
                    strokeWidth={0.5 / k}
                    tabIndex={0}
                    className="cursor-pointer outline-none transition-opacity duration-200 motion-reduce:transition-none hover:opacity-80 focus-visible:opacity-80"
                    onMouseMove={(e) => showTip(e, name, count)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      showTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, name, count);
                    }}
                    onBlur={() => setTip(null)}
                  >
                    <title>{`${name} · ${count.toLocaleString()} ${unit}`}</title>
                  </path>
                );
              })}
            </g>

            {/* City bubbles — constant screen size (radius / k) so clusters
                separate when zooming instead of overlapping. */}
            <g>
              {cityPoints.map((p, i) => (
                <circle
                  key={`${p.city}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={radiusFor(p.count) / k}
                  fill="#c49a3a"
                  fillOpacity={0.55}
                  stroke="#a8812e"
                  strokeWidth={1 / k}
                  tabIndex={0}
                  className="cursor-pointer outline-none transition-opacity duration-200 motion-reduce:transition-none hover:opacity-90 focus-visible:opacity-90"
                  onMouseMove={(e) => showTip(e, p.city, p.count)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => {
                    const rr = e.currentTarget.getBoundingClientRect();
                    showTip({ clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height / 2 }, p.city, p.count);
                  }}
                  onBlur={() => setTip(null)}
                >
                  <title>{`${p.city} · ${p.count.toLocaleString()} ${unit}`}</title>
                </circle>
              ))}
            </g>

            {/* City labels — counter-scaled (size / k) to stay readable; more
                appear as you zoom in (see cityLabels). */}
            <g className="pointer-events-none">
              {cityLabels.map((p, i) => (
                <text
                  key={`label-${p.city}-${i}`}
                  x={p.x + (radiusFor(p.count) + 3) / k}
                  y={p.y + 3.5 / k}
                  className="font-mono"
                  fontSize={11 / k}
                  fill="#0f1729"
                  stroke="#fefefe"
                  strokeWidth={2.5 / k}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {p.city}
                </text>
              ))}
            </g>
          </g>
        </svg>

        <MapControls zoomIn={pz.zoomIn} zoomOut={pz.zoomOut} reset={pz.reset} isZoomed={pz.isZoomed} />
      </div>

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
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-sage-500">0</span>
          <div
            className="h-2.5 w-40 rounded-sm border border-cream-300"
            style={{
              background: `linear-gradient(to right, ${EMPTY_FILL}, ${RAMP.map((s) => s.hex).join(", ")})`,
            }}
          />
          <span className="font-mono text-[10px] text-sage-500">
            {maxProvince.toLocaleString()}
          </span>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] text-sage-500">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#c49a3a", opacity: 0.55, border: "1px solid #a8812e" }}
          />
          {t("admin.geography.map.legendCity", "도시")}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[10px] text-sage-400">
        {t("admin.geography.map.hint", "드래그 · 스크롤 확대 · 모서리로 크기조절")}
      </div>
    </div>
  );
}
