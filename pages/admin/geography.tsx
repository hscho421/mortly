import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "next-i18next";
import { adminSSR } from "@/lib/admin/ssrAuth";
import AdminShell from "@/components/admin/AdminShell";
import {
  ACard,
  ASectionHead,
  ATabs,
  ASpark,
  AEmpty,
  FilterChip,
} from "@/components/admin/primitives";
import type { TabItem } from "@/components/admin/primitives";
import { continentOf, countryName } from "@/lib/geo/countries";

/**
 * /admin/geography — cookieless visitor-geography analytics.
 *
 * Client-fetches GET /api/admin/geography?days=7|30|90 (admin-auth'd) and
 * renders a KPI row, a Map ⇄ List toggle, and ranking blocks. The map has a
 * World ⇄ Canada scope: World shows gold session bubbles per country
 * (WorldMap); Canada keeps the province choropleth + city bubbles (CanadaMap).
 * Both maps load ssr:false (d3-geo + the geojson fetch run client-side). A
 * ranking list always renders under the map so the map is never the sole view.
 */

const WorldMap = dynamic(() => import("@/components/admin/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[860px] aspect-[900/460] rounded-sm bg-cream-50 animate-pulse" />
  ),
});

const CanadaMap = dynamic(() => import("@/components/admin/CanadaMap"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[600px] aspect-[4/3] rounded-sm bg-cream-50 animate-pulse" />
  ),
});

type Days = 1 | 7 | 30 | 90;
type ViewTab = "map" | "list";
type MapScope = "world" | "canada";

interface CountryRow {
  code: string;
  count: number;
}
interface ProvinceRow {
  region: string;
  name: string;
  count: number;
}
interface CaCityRow {
  city: string;
  region: string | null;
  province: string;
  lat: number | null;
  lng: number | null;
  count: number;
}
interface GlobalCityRow {
  city: string;
  country: string;
  count: number;
}
interface DailyRow {
  date: string;
  count: number;
}

interface GeoData {
  days: number;
  total: number;
  mobilePct: number;
  countriesReached: number;
  provincesReached: number;
  citiesReached: number;
  byCountry: CountryRow[];
  byProvince: ProvinceRow[];
  caCities: CaCityRow[];
  topCities: GlobalCityRow[];
  byDevice: Array<{ device: string; count: number }>;
  byReferrer: Array<{ referrer: string; count: number }>;
  byRole: Array<{ role: string; count: number }>;
  daily: DailyRow[];
}

// KO fallbacks used only if a locale key is somehow missing; the rendered
// label is resolved via t(`admin.geography.{role,device}.${key}`).
const ROLE_FALLBACK: Record<string, string> = {
  anon: "익명",
  borrower: "신청인",
  broker: "전문가",
};
const DEVICE_FALLBACK: Record<string, string> = {
  mobile: "모바일",
  desktop: "데스크톱",
  tablet: "태블릿",
  unknown: "알 수 없음",
};

export default function AdminGeographyPage() {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language?.startsWith("ko") ? "ko" : "en";
  const [days, setDays] = useState<Days>(7);
  const [view, setView] = useState<ViewTab>("map");
  const [scope, setScope] = useState<MapScope>("world");
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch(`/api/admin/geography?days=${days}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as GeoData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const tabs: TabItem[] = [
    { key: "map", label: t("admin.geography.tabs.map", "지도") },
    { key: "list", label: t("admin.geography.tabs.list", "목록") },
  ];

  const total = data?.total ?? 0;
  const isEmpty = !loading && !error && data != null && total === 0;

  // Continent rollup is derived client-side from the country counts.
  const byContinent = useMemo(() => {
    if (!data) return [] as Array<{ slug: string; count: number }>;
    const m = new Map<string, number>();
    for (const c of data.byCountry) {
      const slug = continentOf(c.code);
      m.set(slug, (m.get(slug) ?? 0) + c.count);
    }
    return [...m.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const countryRows = (rows: CountryRow[]) =>
    rows.map((c) => ({ label: countryName(c.code, lang, c.code), count: c.count }));

  return (
    <AdminShell active="geography" pageTitle={t("admin.geography.pageTitle", "지역 분석 · mortly admin")}>
      <div className="px-4 md:px-7 pt-6 pb-10">
        <ASectionHead
          big
          label={t("admin.nav.geography", "지역")}
          title={t("admin.geography.title", "지역 분석")}
          subtitle={t(
            "admin.geography.subtitle",
            "쿠키 없이 수집된 방문자 지역 데이터입니다.",
          )}
          right={
            <div className="flex items-center gap-1.5">
              {([1, 7, 30, 90] as const).map((d) => (
                <FilterChip
                  key={d}
                  label={
                    d === 1
                      ? t("admin.geography.last24h", "지난 24시간")
                      : t("admin.geography.lastNDays", "지난 {{n}}일", { n: d })
                  }
                  active={days === d}
                  onClick={() => setDays(d)}
                />
              ))}
            </div>
          }
        />

        {error ? (
          <ACard>
            <div className="py-10 text-center text-sm text-sage-500">
              {t("admin.geography.error", "지역 데이터를 불러올 수 없습니다.")}
            </div>
          </ACard>
        ) : loading && !data ? (
          <ACard>
            <div className="py-10 text-center text-sm text-sage-500">
              {t("common.loading", "로딩 중…")}
            </div>
          </ACard>
        ) : isEmpty ? (
          <AEmpty
            title={t("admin.geography.empty.title", "아직 방문 데이터가 없습니다")}
            body={t(
              "admin.geography.empty.body",
              "방문자가 생기면 여기에 표시됩니다.",
            )}
          />
        ) : data ? (
          <>
            {/* ── KPI row ─────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <ACard className="flex flex-col justify-between" pad={18}>
                <KpiLabel>{t("admin.geography.kpi.sessions", "총 세션")}</KpiLabel>
                <div className="flex items-end justify-between gap-2 mt-1">
                  <KpiValue>{data.total.toLocaleString()}</KpiValue>
                  {data.daily.length > 1 && (
                    <div className="text-amber-500 w-20 h-9 shrink-0">
                      <ASpark
                        points={data.daily.map((d) => d.count)}
                        width={80}
                        height={36}
                        stroke={1.5}
                        className="w-full h-full"
                      />
                    </div>
                  )}
                </div>
              </ACard>
              <ACard pad={18}>
                <KpiLabel>{t("admin.geography.kpi.countries", "국가 수")}</KpiLabel>
                <KpiValue className="mt-1">{data.countriesReached.toLocaleString()}</KpiValue>
              </ACard>
              <ACard pad={18}>
                <KpiLabel>{t("admin.geography.kpi.cities", "도시 수")}</KpiLabel>
                <KpiValue className="mt-1">{data.citiesReached.toLocaleString()}</KpiValue>
              </ACard>
              <ACard pad={18}>
                <KpiLabel>{t("admin.geography.kpi.mobile", "모바일")}</KpiLabel>
                <KpiValue className="mt-1">{data.mobilePct}%</KpiValue>
              </ACard>
            </div>

            {/* ── View toggle ─────────────────────────── */}
            <div className="mt-6">
              <ATabs items={tabs} active={view} onChange={(k) => setView(k as ViewTab)} />
            </div>

            <div className="mt-5">
              {view === "map" ? (
                <div className="grid grid-cols-1 gap-5">
                  {/* Map hero — full-width card, the map sits flush inside (the
                      card provides the only border). */}
                  <ACard pad={0} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-cream-200 flex-wrap gap-2">
                      <ASectionHead
                        title={
                          scope === "world"
                            ? t("admin.geography.scope.world", "전 세계")
                            : t("admin.geography.scope.canada", "캐나다")
                        }
                      />
                      <div className="flex items-center gap-1.5">
                        <FilterChip
                          label={t("admin.geography.scope.world", "전 세계")}
                          active={scope === "world"}
                          onClick={() => setScope("world")}
                        />
                        <FilterChip
                          label={t("admin.geography.scope.canada", "캐나다")}
                          active={scope === "canada"}
                          onClick={() => setScope("canada")}
                        />
                      </div>
                    </div>
                    <div className="p-3 md:p-4">
                      {scope === "world" ? (
                        <WorldMap countries={data.byCountry} />
                      ) : (
                        <CanadaMap provinces={data.byProvince} cities={data.caCities} />
                      )}
                    </div>
                  </ACard>

                  {/* Rankings below the map — the data-table fallback so the map
                      is never the sole representation of the data. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {scope === "world" ? (
                      <>
                        <RankBlock
                          title={t("admin.geography.section.countries", "국가")}
                          rows={countryRows(data.byCountry)}
                          total={total}
                        />
                        <RankBlock
                          title={t("admin.geography.section.continents", "대륙")}
                          rows={byContinent.map((c) => ({
                            label: t(`admin.geography.continent.${c.slug}`, c.slug),
                            count: c.count,
                          }))}
                          total={total}
                        />
                      </>
                    ) : (
                      <>
                        <RankBlock
                          title={t("admin.geography.section.provinces", "지역(주)")}
                          rows={data.byProvince.map((p) => ({ label: p.name, count: p.count }))}
                          total={total}
                        />
                        <RankBlock
                          title={t("admin.geography.section.cities", "주요 도시")}
                          rows={data.caCities.slice(0, 25).map((c) => ({
                            label: c.city,
                            sub: c.province,
                            count: c.count,
                          }))}
                          total={total}
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <RankBlock
                    title={t("admin.geography.section.countries", "국가")}
                    rows={countryRows(data.byCountry)}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.continents", "대륙")}
                    rows={byContinent.map((c) => ({
                      label: t(`admin.geography.continent.${c.slug}`, c.slug),
                      count: c.count,
                    }))}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.cities", "주요 도시")}
                    rows={data.topCities.slice(0, 25).map((c) => ({
                      label: c.city,
                      sub: countryName(c.country, lang, c.country),
                      count: c.count,
                    }))}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.provincesCa", "지역(주) · 캐나다")}
                    rows={data.byProvince.map((p) => ({ label: p.name, count: p.count }))}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.devices", "기기")}
                    rows={data.byDevice.map((d) => ({
                      label: t(`admin.geography.device.${d.device}`, DEVICE_FALLBACK[d.device] ?? d.device),
                      count: d.count,
                    }))}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.referrers", "유입 경로")}
                    rows={data.byReferrer.map((r) => ({
                      label:
                        r.referrer === "direct"
                          ? t("admin.geography.direct", "직접 방문")
                          : r.referrer,
                      count: r.count,
                    }))}
                    total={total}
                  />
                  <RankBlock
                    title={t("admin.geography.section.roles", "방문자 유형")}
                    rows={data.byRole.map((r) => ({
                      label: t(`admin.geography.role.${r.role}`, ROLE_FALLBACK[r.role] ?? r.role),
                      count: r.count,
                    }))}
                    total={total}
                  />
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

// ── small presentational helpers ───────────────────────────────

function KpiLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
      {children}
    </div>
  );
}

function KpiValue({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`font-display text-2xl sm:text-3xl font-semibold text-forest-800 leading-none ${className}`}>
      {children}
    </div>
  );
}

interface RankRow {
  label: string;
  sub?: string;
  count: number;
}

function RankBlock({
  title,
  rows,
  total,
}: {
  title: string;
  rows: RankRow[];
  total: number;
}) {
  const { t } = useTranslation("common");
  const max = useMemo(() => rows.reduce((mx, r) => Math.max(mx, r.count), 0), [rows]);
  return (
    <ACard pad={0}>
      <div className="px-5 pt-4 pb-3 border-b border-cream-200">
        <ASectionHead title={title} />
      </div>
      <div className="px-5 py-3">
        {rows.length === 0 ? (
          <div className="py-6 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-sage-400">
            {t("admin.geography.noData", "데이터 없음")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) => {
              const pct = total > 0 ? (r.count / total) * 100 : 0;
              const barPct = max > 0 ? (r.count / max) * 100 : 0;
              return (
                <li key={`${r.label}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-[13px] font-medium text-forest-800 truncate">
                      {r.label}
                      {r.sub && (
                        <span className="ml-1.5 font-mono text-[10px] text-sage-500">
                          {r.sub}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-sage-500 tabular-nums">
                      {r.count.toLocaleString()}
                      <span className="ml-1.5 text-sage-400">{Math.round(pct)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-cream-200 overflow-hidden">
                    <div
                      className="h-full rounded-sm bg-amber-500 transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ACard>
  );
}

export const getServerSideProps = adminSSR();
