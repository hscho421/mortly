import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import useSWR from "swr";
import { adminSSR } from "@/lib/admin/ssrAuth";
import AdminShell from "@/components/admin/AdminShell";
import { useToast } from "@/components/Toast";
import { useAdminData } from "@/lib/admin/AdminDataContext";
import {
  AAvatar,
  ABadge,
  ABtn,
  ASectionHead,
  FilterChip,
  AConfirmDialog,
  toneForRole,
  toneForUserStatus,
  toneForVerification,
} from "@/components/admin/primitives";
import { useAdminUrlFilters, parseEnum } from "@/lib/admin/useAdminUrlFilters";
import { useAdminShortcuts } from "@/lib/admin/useAdminShortcuts";

/**
 * /admin/people — one table for all users.
 *
 * Phase 7:
 *   - List fetch migrated to SWR (stable key = endpoint + query string).
 *     Navigation-back no longer refetches, tabs share the cache.
 *   - `PersonRow` extracted + memoized so row re-render is O(changed-rows).
 *   - `useAdminShortcuts` adds J/K/Enter/Space for cursor + selection.
 */

interface PersonRow {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
  broker: {
    id: string;
    verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
    subscriptionTier: string;
    responseCredits: number;
    brokerageName: string;
  } | null;
  _count: {
    borrowerRequests: number;
    conversations: number;
  };
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type RoleFilter = "ALL" | "BORROWER" | "BROKER" | "ADMIN";
type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "BANNED";
type BulkKind = "SUSPEND" | "BAN" | "REACTIVATE";

interface BulkApiResult {
  results: Array<{ id: string; ok: boolean; error?: string }>;
  summary: { total: number; succeeded: number; failed: number };
}

const ROLE_VALUES = ["BORROWER", "BROKER", "ADMIN"] as const;
const STATUS_VALUES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
const PAGE_SIZE = 25;

// SWR fetcher — shared so multiple hooks hitting the same URL dedupe.
const jsonFetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
};

export default function AdminPeoplePage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const { invalidate } = useAdminData();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { filters, patch } = useAdminUrlFilters((q) => ({
    role: parseEnum(q.role, ROLE_VALUES, "ALL" as const),
    status: parseEnum(q.status, STATUS_VALUES, "ALL" as const),
    q: typeof q.q === "string" ? q.q : "",
    page: typeof q.page === "string" ? q.page : "1",
  }));

  const roleFilter: RoleFilter = filters.role;
  const statusFilter: StatusFilter = filters.status;
  const search = filters.q;
  const pageNum = (() => {
    const n = parseInt(filters.page, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();

  const setRoleFilter = (r: RoleFilter) =>
    patch({ role: r === "ALL" ? null : r, page: null });
  const setStatusFilter = (s: StatusFilter) =>
    patch({ status: s === "ALL" ? null : s });
  const setPage = (p: number) => patch({ page: p <= 1 ? null : String(p) });

  // Build the SWR key. String-interpolated so changing any filter re-keys
  // and SWR fetches the new page; unchanged re-renders reuse the cache.
  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    return `/api/admin/users?${params.toString()}`;
  }, [pageNum, roleFilter, statusFilter, search]);

  const { data, isLoading, isValidating, mutate: refetchList } = useSWR<Paginated<PersonRow>>(
    listUrl,
    jsonFetcher,
    {
      // Preserve the previous list during filter transitions so the table
      // doesn't blink to empty while the next page loads.
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const rows = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const loading = isLoading && !data;

  // Drop selections that fall off the visible page.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  // Debounced search — local input, commit to URL after 250ms.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const id = setTimeout(() => patch({ q: searchInput || null, page: null }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const pagesTotal = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Handlers — stable via useCallback so the memoed row won't re-render
  // on every parent state tick.
  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id));
      const next = new Set(prev);
      if (allSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }, [rows]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Keyboard nav — J/K cursor, Enter opens, Space toggles selection.
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (cursor >= rows.length) setCursor(Math.max(0, rows.length - 1));
  }, [cursor, rows.length]);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  });
  useAdminShortcuts([
    {
      key: ["j", "ArrowDown"],
      handler: () => setCursor((c) => Math.min(c + 1, rows.length - 1)),
    },
    {
      key: ["k", "ArrowUp"],
      handler: () => setCursor((c) => Math.max(c - 1, 0)),
    },
    {
      key: "Enter",
      handler: () => {
        const r = rows[cursorRef.current];
        if (r) router.push(`/admin/users/${r.publicId}`);
      },
    },
    {
      key: " ",
      handler: () => {
        const r = rows[cursorRef.current];
        if (r) toggleSelected(r.id);
      },
    },
  ]);

  // Bulk actions — unchanged semantics from Phase 3/5, now using refetchList
  // (SWR mutate) to surface fresh data without a full page reload.
  const [bulkPending, setBulkPending] = useState<BulkKind | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const runBulk = useCallback(async () => {
    if (!bulkPending || selected.size === 0) return;
    const status =
      bulkPending === "SUSPEND" ? "SUSPENDED" : bulkPending === "BAN" ? "BANNED" : "ACTIVE";
    setBulkSaving(true);
    try {
      const r = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const payload = (await r.json()) as BulkApiResult;
      if (payload.summary.failed > 0) {
        toast(
          t("admin.people.bulk.partial", "{{ok}}건 적용 · {{fail}}건 실패", {
            ok: payload.summary.succeeded,
            fail: payload.summary.failed,
          }),
          "error",
        );
      } else {
        toast(
          t("admin.people.bulk.done", "{{n}}건 적용됨", {
            n: payload.summary.succeeded,
          }),
          "success",
        );
      }
      clearSelection();
      void refetchList();
      void invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBulkSaving(false);
      setBulkPending(null);
    }
  }, [bulkPending, selected, clearSelection, refetchList, invalidate, t, toast]);

  const counts = useMemo(() => {
    const base = { ALL: total, BORROWER: 0, BROKER: 0, ADMIN: 0 };
    rows.forEach((r) => {
      base[r.role] += 1;
    });
    return base;
  }, [rows, total]);

  const bulkConfirmTitle: Record<BulkKind, string> = {
    SUSPEND: t("admin.people.bulk.confirmTitle.suspend", "선택 사용자 정지"),
    BAN: t("admin.people.bulk.confirmTitle.ban", "선택 사용자 차단"),
    REACTIVATE: t("admin.people.bulk.confirmTitle.reactivate", "선택 사용자 재활성화"),
  };

  return (
    <AdminShell
      active="people"
      pageTitle={t("admin.people.pageTitle", "사용자 · mortly admin")}
    >
      <div className="px-7 pt-6">
        <ASectionHead
          label={t("admin.nav.people", "사용자")}
          title={
            <>
              {t("admin.people.titlePrefix", "플랫폼 사용자 ")}
              <span className="font-mono text-2xl text-amber-600">{total.toLocaleString()}</span>
              {t("admin.people.titleSuffix", "명")}
            </>
          }
          subtitle={t(
            "admin.people.subtitle",
            "모든 계정을 한 곳에서 — 역할과 상태로 필터, 일괄 조치 가능.",
          )}
          right={
            <>
              <ABtn size="sm" variant="ghost" disabled>
                ⬇ CSV
              </ABtn>
              <ABtn size="sm" disabled>
                + {t("admin.people.invite", "초대")}
              </ABtn>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-1.5 mt-4 pb-3 border-b border-cream-300">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("admin.people.searchPlaceholder", "이름 · 이메일 검색…")}
            className="input-field max-w-[260px] py-1.5 !px-3 text-sm"
          />
          <FilterChip
            label={t("admin.people.role.all", "전체")}
            count={counts.ALL}
            active={roleFilter === "ALL"}
            onClick={() => setRoleFilter("ALL")}
          />
          <FilterChip
            label={t("admin.people.role.borrowers", "신청인")}
            active={roleFilter === "BORROWER"}
            onClick={() => setRoleFilter("BORROWER")}
          />
          <FilterChip
            label={t("admin.people.role.brokers", "전문가")}
            active={roleFilter === "BROKER"}
            onClick={() => setRoleFilter("BROKER")}
          />
          <FilterChip
            label={t("admin.people.role.admins", "관리자")}
            active={roleFilter === "ADMIN"}
            onClick={() => setRoleFilter("ADMIN")}
          />
          <FilterChip divider label="" />
          <FilterChip
            label={t("admin.people.status.all", "전체 상태")}
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          />
          <FilterChip
            label={t("admin.people.status.active", "활성")}
            active={statusFilter === "ACTIVE"}
            onClick={() => setStatusFilter("ACTIVE")}
          />
          <FilterChip
            label={t("admin.people.status.suspended", "정지")}
            active={statusFilter === "SUSPENDED"}
            onClick={() => setStatusFilter("SUSPENDED")}
          />
          <FilterChip
            label={t("admin.people.status.banned", "차단")}
            active={statusFilter === "BANNED"}
            onClick={() => setStatusFilter("BANNED")}
          />
        </div>

        <div className="flex items-center justify-between py-2.5 text-xs text-sage-500">
          <div>
            {selected.size > 0 ? (
              <>
                <b className="text-forest-800">{selected.size}명</b>{" "}
                {t("admin.people.bulk.selected", "선택됨")} ·{" "}
                {t("admin.people.bulk.apply", "일괄 작업: ")}
                <button
                  className="text-forest-800 font-semibold ml-2 hover:underline"
                  onClick={() => setBulkPending("SUSPEND")}
                  data-testid="bulk-suspend"
                >
                  {t("admin.people.bulk.suspend", "정지")}
                </button>
                <span className="mx-1">·</span>
                <button
                  className="text-forest-800 font-semibold hover:underline"
                  onClick={() => setBulkPending("BAN")}
                  data-testid="bulk-ban"
                >
                  {t("admin.people.bulk.ban", "차단")}
                </button>
                <span className="mx-1">·</span>
                <button
                  className="text-forest-800 font-semibold hover:underline"
                  onClick={() => setBulkPending("REACTIVATE")}
                  data-testid="bulk-reactivate"
                >
                  {t("admin.people.bulk.reactivate", "활성화")}
                </button>
                <span className="mx-2 text-sage-500">·</span>
                <button
                  className="text-sage-500 hover:underline"
                  onClick={clearSelection}
                  data-testid="bulk-clear"
                >
                  {t("admin.people.bulk.clear", "선택 해제")}
                </button>
              </>
            ) : (
              <span className="text-sage-500">
                {t("admin.people.bulk.hint", "행을 선택하면 일괄 작업이 가능합니다.")}
              </span>
            )}
          </div>
          <span className="font-mono flex items-center gap-2">
            {isValidating && !loading && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {rows.length > 0
              ? `${(pageNum - 1) * PAGE_SIZE + 1}–${(pageNum - 1) * PAGE_SIZE + rows.length}`
              : "0"}{" "}
            / {total.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="px-7 pb-10">
        <div className="bg-cream-50 border border-cream-300">
          <div className="grid grid-cols-[36px_2.2fr_1fr_1.2fr_1fr_1fr_120px] gap-3.5 px-5 py-2.5 font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em] border-b border-cream-300 bg-cream-200/60">
            <span>
              <label className="sr-only" htmlFor="admin-people-select-all">
                {t("admin.people.col.selectAll", "전체 선택")}
              </label>
              <input
                id="admin-people-select-all"
                type="checkbox"
                checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                onChange={toggleAllVisible}
              />
            </span>
            <span>{t("admin.people.col.user", "사용자")}</span>
            <span>{t("admin.people.col.id", "ID · 가입")}</span>
            <span>{t("admin.people.col.role", "역할 · 구독")}</span>
            <span>{t("admin.people.col.status", "상태")}</span>
            <span>{t("admin.people.col.activity", "활동 요약")}</span>
            <span />
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-sage-500">
              {t("common.loading", "로딩 중…")}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-sage-500">
              {t("admin.people.empty", "조건에 맞는 사용자가 없습니다.")}
            </div>
          ) : (
            rows.map((u, i) => (
              <PersonRowView
                key={u.id}
                user={u}
                isLast={i === rows.length - 1}
                isSelected={selected.has(u.id)}
                isCursor={cursor === i}
                onToggle={toggleSelected}
                openLabel={t("admin.people.open", "열기")}
                selectRowLabelTemplate={t(
                  "admin.people.col.selectRow",
                  "{{name}} 선택",
                  { name: u.name || u.email },
                )}
              />
            ))
          )}

          <div className="flex items-center justify-between px-5 py-2.5 text-xs text-sage-500 bg-cream-200/60 border-t border-cream-200">
            <span className="font-mono">
              {t("admin.people.pageLabel", "페이지")} {pageNum}/{pagesTotal}
            </span>
            <div className="flex gap-2">
              <button
                disabled={pageNum <= 1 || loading}
                onClick={() => setPage(Math.max(1, pageNum - 1))}
                className="disabled:opacity-40"
              >
                ← {t("admin.people.prev", "이전")}
              </button>
              <span className="font-mono text-forest-800 font-semibold">{pageNum}</span>
              <button
                disabled={pageNum >= pagesTotal || loading}
                onClick={() => setPage(Math.min(pagesTotal, pageNum + 1))}
                className="disabled:opacity-40"
              >
                {t("admin.people.next", "다음")} →
              </button>
            </div>
          </div>
        </div>
      </div>

      {bulkPending && (
        <AConfirmDialog
          open
          onClose={() => setBulkPending(null)}
          tone={bulkPending === "REACTIVATE" ? "default" : "danger"}
          title={bulkConfirmTitle[bulkPending]}
          description={t(
            "admin.people.bulk.confirmBody",
            "선택한 {{n}}명의 계정 상태를 변경합니다.",
            { n: selected.size },
          )}
          confirmLabel={t("admin.people.bulk.confirmLabel", "진행")}
          onConfirm={runBulk}
          loading={bulkSaving}
        />
      )}
    </AdminShell>
  );
}

// ── Row ─────────────────────────────────────────────────────────

interface PersonRowViewProps {
  user: PersonRow;
  isLast: boolean;
  isSelected: boolean;
  isCursor: boolean;
  onToggle: (id: string) => void;
  openLabel: string;
  selectRowLabelTemplate: string;
}

const PersonRowView = memo(function PersonRowView({
  user: u,
  isLast,
  isSelected,
  isCursor,
  onToggle,
  openLabel,
  selectRowLabelTemplate,
}: PersonRowViewProps) {
  const initials = (u.name || u.email)[0]?.toUpperCase() ?? "•";
  const roleSubline =
    u.role === "BROKER" && u.broker
      ? `${u.broker.brokerageName} · ${u.broker.subscriptionTier}`
      : u.role === "ADMIN"
      ? "Platform Admin"
      : "";
  const activitySummary =
    u.role === "BROKER" && u.broker
      ? `크레딧 ${u.broker.responseCredits}`
      : `${u._count.borrowerRequests} 요청 · ${u._count.conversations} 대화`;

  return (
    <div
      className={`grid grid-cols-[36px_2.2fr_1fr_1.2fr_1fr_1fr_120px] gap-3.5 px-5 py-3.5 items-center text-[13px] ${
        isLast ? "" : "border-b border-cream-200"
      } ${isSelected ? "bg-amber-50" : ""} ${
        isCursor ? "ring-1 ring-amber-500 ring-inset" : ""
      }`}
    >
      <span>
        <label className="sr-only" htmlFor={`admin-people-select-${u.id}`}>
          {selectRowLabelTemplate}
        </label>
        <input
          id={`admin-people-select-${u.id}`}
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(u.id)}
          aria-label={u.name || u.email}
        />
      </span>
      <div className="flex items-center gap-2.5 min-w-0">
        <AAvatar size={32} initials={initials} />
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-1.5">
            {u.name || <span className="text-sage-500">—</span>}
            {u.broker && (
              <ABadge tone={toneForVerification(u.broker.verificationStatus)}>
                {u.broker.verificationStatus}
              </ABadge>
            )}
          </div>
          <div className="text-[11px] text-sage-500 truncate">{u.email}</div>
        </div>
      </div>
      <div>
        <div className="font-mono text-[11px]">{u.publicId}</div>
        <div className="font-mono text-[11px] text-sage-500">{formatYYYYMM(u.createdAt)}</div>
      </div>
      <div>
        <ABadge tone={toneForRole(u.role)}>{u.role}</ABadge>
        {roleSubline && (
          <div className="text-[11px] text-sage-500 mt-1 truncate">{roleSubline}</div>
        )}
      </div>
      <ABadge tone={toneForUserStatus(u.status)}>{u.status}</ABadge>
      <span className="text-[12px] text-forest-700/80 font-mono truncate">
        {activitySummary}
      </span>
      <div className="flex gap-1.5 justify-end">
        <Link href={`/admin/users/${u.publicId}`} className="btn-ghost !px-3 !py-1 !text-xs">
          {openLabel}
        </Link>
      </div>
    </div>
  );
});

function formatYYYYMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const getServerSideProps = adminSSR();
