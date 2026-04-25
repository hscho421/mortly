import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import BrokerShell from "@/components/broker/BrokerShell";
import {
  AppTopbar,
  Badge,
  Btn,
  Card,
  EmptyState,
  Eyebrow,
} from "@/components/broker/ui";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import {
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@/lib/requestConfig";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
];

interface BrokerRequest {
  id: string;
  publicId: string;
  province: string;
  city?: string | null;
  status: string;
  createdAt: string;
  mortgageCategory?: string | null;
  productTypes?: string[] | null;
  desiredTimeline?: string | null;
  conversations?: { broker?: { userId: string } }[];
  _count?: { conversations?: number };
  /** True if this broker hasn't marked this request as seen yet. */
  isNew?: boolean;
}

type CategoryFilter = "" | "RESIDENTIAL" | "COMMERCIAL";

function relativeTime(dateStr: string, locale: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const m = Math.max(0, Math.floor((now - then) / 60_000));
  if (m < 1) return locale === "ko" ? "방금" : "just now";
  if (m < 60) return locale === "ko" ? `${m}분 전` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === "ko" ? `${h}시간 전` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return locale === "ko" ? `${d}일 전` : `${d}d`;
  return new Date(dateStr).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-CA",
    { month: "short", day: "numeric" },
  );
}

export default function BrokerRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [requests, setRequests] = useState<BrokerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<"" | "NOT_VERIFIED" | "LOAD_FAILED">("");
  const [newCount, setNewCount] = useState(0);

  const [filterProvince, setFilterProvince] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("");
  const [onlyUnresponded, setOnlyUnresponded] = useState(true);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterProvince) params.set("province", filterProvince);
      if (filterCategory) params.set("mortgageCategory", filterCategory);

      const res = await fetch(`/api/requests?${params.toString()}`);
      if (res.status === 403) {
        setError("NOT_VERIFIED");
        return;
      }
      if (!res.ok) {
        setError("LOAD_FAILED");
        return;
      }
      const json = await res.json();
      setRequests((json.data ?? json) as BrokerRequest[]);
      if (typeof json.newCount === "number") setNewCount(json.newCount);
    } catch {
      setError("LOAD_FAILED");
    } finally {
      setIsLoading(false);
    }
  }, [filterProvince, filterCategory]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchRequests();
  }, [status, fetchRequests]);

  // Mark requests as seen on unmount so the gold "new" dots clear next visit.
  useEffect(() => {
    if (status !== "authenticated") return;
    return () => {
      fetch("/api/brokers/mark-requests-seen", { method: "POST" }).catch(() => {
        // best-effort
      });
    };
  }, [status]);

  const filteredRequests = useMemo(() => {
    if (!onlyUnresponded) return requests;
    const brokerUserId = session?.user?.id;
    return requests.filter(
      (req) =>
        !req.conversations?.some(
          (conv) => conv.broker?.userId === brokerUserId,
        ),
    );
  }, [requests, onlyUnresponded, session?.user?.id]);

  if (status === "loading") {
    return (
      <BrokerShell active="requests" pageTitle={t("titles.brokerBrowseRequests")}>
        <Head>
          <title>{t("titles.brokerBrowseRequests")}</title>
        </Head>
        <RequestsSkeleton />
      </BrokerShell>
    );
  }

  if (error === "NOT_VERIFIED") {
    return (
      <BrokerShell active="requests" pageTitle={t("titles.brokerBrowseRequests")}>
        <Head>
          <title>{t("titles.brokerBrowseRequests")}</title>
        </Head>
        <AppTopbar
          eyebrow={t("broker.requestsEyebrow", "상담 요청")}
          title={t("broker.browseRequests")}
        />
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <Card padding="lg" className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-amber-100">
              <svg
                className="h-7 w-7 text-amber-700"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <div className="font-display text-2xl font-semibold text-forest-800">
              {t("broker.verificationRequired", "Verification Required")}
            </div>
            <p className="mx-auto mt-3 max-w-md font-body text-[14px] text-forest-700/80">
              {t(
                "broker.verificationRequiredDesc",
                "Your broker profile must be verified before you can browse borrower requests. Please wait for admin approval.",
              )}
            </p>
            <p className="mx-auto mt-2 max-w-md font-body text-[12px] text-sage-500">
              {t("broker.verificationTimeline")}
            </p>
            <p className="mx-auto mb-6 mt-1 max-w-md font-body text-[12px] text-sage-500">
              {t("broker.contactSupport")}{" "}
              <a
                href="mailto:support@mortly.ca"
                className="text-forest-700 underline hover:text-forest-900"
              >
                support@mortly.ca
              </a>
            </p>
            <Btn as="a" href="/broker/dashboard">
              {t("nav.dashboard")}
            </Btn>
          </Card>
        </div>
      </BrokerShell>
    );
  }

  const locale = router.locale === "ko" ? "ko" : "en";

  return (
    <BrokerShell active="requests" pageTitle={t("titles.brokerBrowseRequests")}>
      <Head>
        <title>{t("titles.brokerBrowseRequests")}</title>
      </Head>

      <AppTopbar
        eyebrow={
          <>
            {newCount > 0 ? (
              <>
                <span className="text-amber-500">●</span>{" "}
                {t("broker.newCount", "{{count}} new", { count: newCount })}
              </>
            ) : (
              t("browse.allCaughtUp", "All caught up")
            )}
          </>
        }
        title={t("broker.browseRequests")}
        actions={
          <Btn size="sm" variant="ghost" onClick={() => fetchRequests()}>
            {t("common.refresh", "Refresh")}
          </Btn>
        }
      />

      {/* Filter chip bar */}
      <FilterBar
        province={filterProvince}
        setProvince={setFilterProvince}
        category={filterCategory}
        setCategory={setFilterCategory}
        onlyUnresponded={onlyUnresponded}
        setOnlyUnresponded={setOnlyUnresponded}
      />

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        {error === "LOAD_FAILED" && (
          <div
            role="alert"
            className="mb-4 rounded-sm border border-error-100 bg-error-50 px-4 py-3 font-body text-[13px] text-error-700"
          >
            {t("broker.failedToLoadRequests")}
          </div>
        )}

        {isLoading ? (
          <RequestsSkeleton />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title={t("broker.noMatchingRequests")}
            body={t("broker.noMatchingRequestsDesc")}
            cta={
              onlyUnresponded ? (
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setOnlyUnresponded(false)}
                >
                  {t(
                    "broker.includeResponded",
                    "Include requests I've responded to",
                  )}
                </Btn>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop: dense table */}
            <Card padding="none" className="hidden overflow-hidden md:block">
              <div
                role="row"
                className="grid grid-cols-[110px_1.5fr_1fr_1fr_0.8fr_0.7fr_140px] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500"
              >
                <span>{t("broker.col.id", "ID")}</span>
                <span>{t("broker.col.type", "Type")}</span>
                <span>{t("broker.col.region", "Region")}</span>
                <span>{t("broker.col.timeline", "Timeline")}</span>
                <span>{t("broker.col.responses", "Responses")}</span>
                <span>{t("broker.col.posted", "Posted")}</span>
                <span />
              </div>
              <ul>
                {filteredRequests.map((req) => (
                  <RequestRow key={req.id} req={req} locale={locale} t={t} />
                ))}
              </ul>
            </Card>

            {/* Mobile: card stack */}
            <ul className="space-y-3 md:hidden">
              {filteredRequests.map((req) => (
                <RequestCardMobile
                  key={req.id}
                  req={req}
                  locale={locale}
                  t={t}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </BrokerShell>
  );

  // Re-imported only to keep PROVINCES usable inside FilterBar via closure.
  // `PROVINCES` already imported at module top.
  void PROVINCES;
}

// ──────────────────────────────────────────────────────────────
// Filter bar — chip-style filters mounted below the topbar.
// Sticky so it stays in view while scrolling the list.
// ──────────────────────────────────────────────────────────────
function FilterBar({
  province,
  setProvince,
  category,
  setCategory,
  onlyUnresponded,
  setOnlyUnresponded,
}: {
  province: string;
  setProvince: (v: string) => void;
  category: CategoryFilter;
  setCategory: (v: CategoryFilter) => void;
  onlyUnresponded: boolean;
  setOnlyUnresponded: (v: boolean) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="sticky top-[73px] z-10 flex flex-wrap items-center gap-2 border-b border-cream-300 bg-cream-50 px-5 py-3 sm:px-8">
      <ChipSelect
        value={province}
        onChange={setProvince}
        label={province || t("broker.allProvinces")}
        options={[
          { value: "", label: t("broker.allProvinces") },
          ...PROVINCES.map((p) => ({ value: p, label: p })),
        ]}
      />
      <ChipSelect
        value={category}
        onChange={(v) => setCategory(v as CategoryFilter)}
        label={
          category === "COMMERCIAL"
            ? t("request.commercial")
            : category === "RESIDENTIAL"
              ? t("request.residential")
              : t("broker.allTypes")
        }
        options={[
          { value: "", label: t("broker.allTypes") },
          { value: "RESIDENTIAL", label: t("request.residential") },
          { value: "COMMERCIAL", label: t("request.commercial") },
        ]}
      />
      <button
        type="button"
        onClick={() => setOnlyUnresponded(!onlyUnresponded)}
        aria-pressed={onlyUnresponded}
        className={`rounded-sm border px-3 py-1.5 font-body text-[12px] transition-colors ${
          onlyUnresponded
            ? "border-amber-500 bg-amber-50 text-amber-700"
            : "border-cream-300 bg-cream-50 text-forest-700/80 hover:bg-cream-200"
        }`}
      >
        {t("broker.onlyUnresponded", "Only unresponded")}
      </button>
    </div>
  );
}

function ChipSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-sm border border-cream-300 bg-cream-50 px-3 py-1.5 font-body text-[12px] text-forest-700/80 transition-colors hover:bg-cream-200">
      {label}
      <svg
        className="h-3 w-3 text-sage-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m19.5 8.25-7.5 7.5-7.5-7.5"
        />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value || "__all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ──────────────────────────────────────────────────────────────
// Rows
// ──────────────────────────────────────────────────────────────
import type { TFunction } from "i18next";
type Translator = TFunction<"common">;

function typeLabel(
  req: BrokerRequest,
  t: Translator,
): string {
  const cat =
    req.mortgageCategory === "COMMERCIAL"
      ? t("request.commercial")
      : t("request.residential");
  const first = (req.productTypes ?? [])[0];
  const prod = first ? t(PRODUCT_LABEL_KEYS[first] ?? first) : "";
  return prod ? `${cat} · ${prod}` : cat;
}

function RequestRow({
  req,
  locale,
  t,
}: {
  req: BrokerRequest;
  locale: string;
  t: Translator;
}) {
  const region = req.city ? `${req.city}, ${req.province}` : req.province;
  const responses = req._count?.conversations ?? 0;
  return (
    <li>
      <Link
        href={`/broker/requests/${req.publicId}`}
        className="group grid grid-cols-[110px_1.5fr_1fr_1fr_0.8fr_0.7fr_140px] items-center gap-3 border-b border-cream-200 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-cream-100"
      >
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-sage-500">
          {req.isNew && (
            <span
              aria-label="New"
              className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          )}
          #{req.publicId}
        </span>
        <span className="truncate font-body text-[13px] font-semibold text-forest-800">
          {typeLabel(req, t)}
        </span>
        <span className="truncate font-body text-[13px] text-forest-700/80">
          {region}
        </span>
        <span className="font-body text-[12px] text-forest-700/70">
          {req.desiredTimeline
            ? t(TIMELINE_LABEL_KEYS[req.desiredTimeline] ?? req.desiredTimeline)
            : "—"}
        </span>
        <span className="font-mono text-[12px] text-forest-700">
          {responses > 0
            ? `${responses}`
            : <span className="font-semibold text-success-700">{t("broker.openForResponse", "Open")}</span>}
        </span>
        <span className="font-mono text-[11px] text-sage-500">
          {relativeTime(req.createdAt, locale)}
        </span>
        <span className="inline-flex items-center justify-end gap-1 font-mono text-[11px] font-semibold text-forest-700 transition-colors group-hover:text-amber-600">
          {t("broker.respond", "상담 시작")} →
        </span>
      </Link>
    </li>
  );
}

function RequestCardMobile({
  req,
  locale,
  t,
}: {
  req: BrokerRequest;
  locale: string;
  t: Translator;
}) {
  const region = req.city ? `${req.city}, ${req.province}` : req.province;
  const responses = req._count?.conversations ?? 0;
  const label =
    req.mortgageCategory === "COMMERCIAL"
      ? t("request.commercial")
      : t("request.residential");
  return (
    <li>
      <Link
        href={`/broker/requests/${req.publicId}`}
        className={`block rounded-sm border bg-cream-50 px-4 py-3.5 transition-colors hover:bg-cream-100 ${
          req.isNew ? "border-amber-200" : "border-cream-300"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-sage-500">
            {req.isNew && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            #{req.publicId}
          </span>
          <Badge
            tone={req.mortgageCategory === "COMMERCIAL" ? "accent" : "neutral"}
          >
            {label}
          </Badge>
        </div>
        <div className="mt-1.5 font-body text-[14px] font-semibold text-forest-800">
          {typeLabel(req, t)}
        </div>
        <div className="font-body text-[12px] text-forest-700/80">{region}</div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-sage-500">
          <span>
            {req.desiredTimeline
              ? t(TIMELINE_LABEL_KEYS[req.desiredTimeline] ?? req.desiredTimeline)
              : "—"}
            {" · "}
            {relativeTime(req.createdAt, locale)}
          </span>
          <span className="font-semibold text-forest-700">
            {responses > 0
              ? `${responses} ${t("broker.responsesSuffix", "responses")}`
              : t("broker.openForResponse", "Open")}
          </span>
        </div>
      </Link>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────
// Skeleton — matches row cadence to avoid layout shift.
// ──────────────────────────────────────────────────────────────
function RequestsSkeleton() {
  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="hidden overflow-hidden rounded-sm border border-cream-300 bg-cream-50 md:block">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[110px_1.5fr_1fr_1fr_0.8fr_0.7fr_140px] gap-3 border-b border-cream-200 px-5 py-4 last:border-b-0"
          >
            {[...Array(7)].map((__, j) => (
              <span
                key={j}
                className="h-3 animate-pulse rounded-sm bg-cream-200"
              />
            ))}
          </div>
        ))}
      </div>
      <ul className="space-y-3 md:hidden">
        {[...Array(4)].map((_, i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-sm border border-cream-300 bg-cream-50"
          />
        ))}
      </ul>
    </div>
  );
}

// Eyebrow is imported but only used above — silence unused lint.
void Eyebrow;

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
