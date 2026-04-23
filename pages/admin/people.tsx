import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { adminSSR } from "@/lib/admin/ssrAuth";
import AdminShell from "@/components/admin/AdminShell";
import {
  AAvatar,
  ABadge,
  ABtn,
  ASectionHead,
  FilterChip,
} from "@/components/admin/primitives";
import type { Tone } from "@/components/admin/primitives/ABadge";

/**
 * /admin/people — one table for all users. Broker-specific fields render
 * inline when role=BROKER. Filters stack: role chip + status chip + search.
 *
 * Backing API: /api/admin/users (already returns nested broker info).
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

const ROLE_TONE: Record<PersonRow["role"], Tone> = {
  BROKER: "accent",
  ADMIN: "dark",
  BORROWER: "neutral",
};
const STATUS_TONE: Record<PersonRow["status"], Tone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  BANNED: "danger",
};

export default function AdminPeoplePage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk selection must not span filter changes — if a row is no longer in
  // `rows` it shouldn't be in the selected set either, or the count lies.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  // URL-driven state — filters and page live in query params so copy/paste
  // and browser back/forward work correctly.
  const roleFilter: RoleFilter = (() => {
    const r = router.query.role;
    if (typeof r === "string" && ["BORROWER", "BROKER", "ADMIN"].includes(r)) {
      return r as RoleFilter;
    }
    return "ALL";
  })();
  const statusFilter: StatusFilter = (() => {
    const s = router.query.status;
    if (typeof s === "string" && ["ACTIVE", "SUSPENDED", "BANNED"].includes(s)) {
      return s as StatusFilter;
    }
    return "ALL";
  })();
  const search = typeof router.query.q === "string" ? router.query.q : "";
  const page = (() => {
    const p = parseInt((router.query.page as string) ?? "1", 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  })();

  const patchQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(router.query)) {
        if (typeof v === "string") next[k] = v;
      }
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      router.replace({ pathname: router.pathname, query: next }, undefined, {
        shallow: true,
        locale: router.locale,
      });
    },
    [router],
  );

  const setRoleFilter = (r: RoleFilter) =>
    patchQuery({ role: r === "ALL" ? null : r, page: null });
  const setStatusFilter = (s: StatusFilter) =>
    patchQuery({ status: s === "ALL" ? null : s, page: null });
  const setPage = (p: number) => patchQuery({ page: p <= 1 ? null : String(p) });

  // Abort in-flight request on filter/page churn so the latest response wins.
  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "25");
      params.set("page", String(page));
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const r = await fetch(`/api/admin/users?${params.toString()}`, {
        signal: ctl.signal,
      });
      if (r.ok) {
        const data = (await r.json()) as Paginated<PersonRow>;
        setRows(data.data);
        setTotal(data.pagination.total);
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") return;
    } finally {
      if (!ctl.signal.aborted) setLoading(false);
    }
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Debounced search — input state is local; commits to URL after 250ms.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    setSearchInput(search); // keep in sync when URL changes externally
  }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const id = setTimeout(() => {
      patchQuery({ q: searchInput || null, page: null });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const pagesTotal = Math.max(1, Math.ceil(total / 25));

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id));
      if (allSelected) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyBulk = async (action: "SUSPEND" | "BAN" | "REACTIVATE") => {
    if (selected.size === 0) return;
    const status = action === "SUSPEND" ? "SUSPENDED" : action === "BAN" ? "BANNED" : "ACTIVE";
    const verb = action === "SUSPEND" ? "정지" : action === "BAN" ? "차단" : "재활성화";
    if (!window.confirm(`${selected.size}명을 ${verb}하시겠습니까?`)) return;
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected" || (r as PromiseFulfilledResult<Response>).value?.ok === false).length;
    if (failed > 0) window.alert(`${failed}건 실패. 나머지는 적용됨.`);
    clearSelection();
    load();
  };

  const counts = useMemo(() => {
    const base = { ALL: total, BORROWER: 0, BROKER: 0, ADMIN: 0 };
    rows.forEach((r) => {
      base[r.role] += 1;
    });
    return base;
  }, [rows, total]);

  return (
    <AdminShell active="people" pageTitle={t("admin.people.pageTitle", "사용자 · mortly admin")}>
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

        {/* Search + chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pb-3 border-b border-cream-300">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("admin.people.searchPlaceholder", "이름 · 이메일 검색…")}
            className="input-field max-w-[260px] py-1.5 !px-3 text-sm"
          />
          <FilterChip label={t("admin.people.role.all", "전체")} count={counts.ALL} active={roleFilter === "ALL"} onClick={() => { setRoleFilter("ALL"); setPage(1); }} />
          <FilterChip label={t("admin.people.role.borrowers", "신청인")} active={roleFilter === "BORROWER"} onClick={() => { setRoleFilter("BORROWER"); setPage(1); }} />
          <FilterChip label={t("admin.people.role.brokers", "전문가")} active={roleFilter === "BROKER"} onClick={() => { setRoleFilter("BROKER"); setPage(1); }} />
          <FilterChip label={t("admin.people.role.admins", "관리자")} active={roleFilter === "ADMIN"} onClick={() => { setRoleFilter("ADMIN"); setPage(1); }} />
          <FilterChip divider label="" />
          <FilterChip label={t("admin.people.status.all", "전체 상태")} active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
          <FilterChip label={t("admin.people.status.active", "활성")} active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} />
          <FilterChip label={t("admin.people.status.suspended", "정지")} active={statusFilter === "SUSPENDED"} onClick={() => setStatusFilter("SUSPENDED")} />
          <FilterChip label={t("admin.people.status.banned", "차단")} active={statusFilter === "BANNED"} onClick={() => setStatusFilter("BANNED")} />
        </div>

        {/* Bulk action bar */}
        <div className="flex items-center justify-between py-2.5 text-xs text-sage-500">
          <div>
            {selected.size > 0 ? (
              <>
                <b className="text-forest-800">{selected.size}명</b> {t("admin.people.bulk.selected", "선택됨")} · {t("admin.people.bulk.apply", "일괄 작업: ")}
                <button className="text-forest-800 font-semibold ml-2 hover:underline" onClick={() => applyBulk("SUSPEND")}>{t("admin.people.bulk.suspend", "정지")}</button>
                <span className="mx-1">·</span>
                <button className="text-forest-800 font-semibold hover:underline" onClick={() => applyBulk("BAN")}>{t("admin.people.bulk.ban", "차단")}</button>
                <span className="mx-1">·</span>
                <button className="text-forest-800 font-semibold hover:underline" onClick={() => applyBulk("REACTIVATE")}>{t("admin.people.bulk.reactivate", "활성화")}</button>
                <span className="mx-2 text-sage-500">·</span>
                <button className="text-sage-500 hover:underline" onClick={clearSelection}>{t("admin.people.bulk.clear", "선택 해제")}</button>
              </>
            ) : (
              <span className="text-sage-500">{t("admin.people.bulk.hint", "행을 선택하면 일괄 작업이 가능합니다.")}</span>
            )}
          </div>
          <span className="font-mono">
            {rows.length > 0 ? `${(page - 1) * 25 + 1}–${(page - 1) * 25 + rows.length}` : "0"} / {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Table */}
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
            <div className="p-8 text-center text-sm text-sage-500">{t("common.loading", "로딩 중…")}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-sage-500">{t("admin.people.empty", "조건에 맞는 사용자가 없습니다.")}</div>
          ) : (
            rows.map((u, i) => {
              const checked = selected.has(u.id);
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
                  key={u.id}
                  className={`grid grid-cols-[36px_2.2fr_1fr_1.2fr_1fr_1fr_120px] gap-3.5 px-5 py-3.5 items-center text-[13px] ${i < rows.length - 1 ? "border-b border-cream-200" : ""} ${checked ? "bg-amber-50" : ""}`}
                >
                  <span>
                    <label className="sr-only" htmlFor={`admin-people-select-${u.id}`}>
                      {t("admin.people.col.selectRow", "{{name}} 선택", { name: u.name || u.email })}
                    </label>
                    <input
                      id={`admin-people-select-${u.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(u.id)}
                      aria-label={u.name || u.email}
                    />
                  </span>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AAvatar size={32} initials={initials} />
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-1.5">
                        {u.name || <span className="text-sage-500">—</span>}
                        {u.broker?.verificationStatus === "VERIFIED" && (
                          <span className="text-success-700 text-[11px]">✓</span>
                        )}
                        {u.broker?.verificationStatus === "PENDING" && (
                          <span className="text-warning-700 text-[11px]">◔</span>
                        )}
                        {u.broker?.verificationStatus === "REJECTED" && (
                          <span className="text-error-700 text-[11px]">!</span>
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
                    <ABadge tone={ROLE_TONE[u.role]}>{u.role}</ABadge>
                    {roleSubline && <div className="text-[11px] text-sage-500 mt-1 truncate">{roleSubline}</div>}
                  </div>
                  <ABadge tone={STATUS_TONE[u.status]}>{u.status}</ABadge>
                  <span className="text-[12px] text-forest-700/80 font-mono truncate">{activitySummary}</span>
                  <div className="flex gap-1.5 justify-end">
                    <Link href={`/admin/users/${u.publicId}`} className="btn-ghost !px-3 !py-1 !text-xs">
                      {t("admin.people.open", "열기")}
                    </Link>
                  </div>
                </div>
              );
            })
          )}

          <div className="flex items-center justify-between px-5 py-2.5 text-xs text-sage-500 bg-cream-200/60 border-t border-cream-200">
            <span className="font-mono">
              {t("admin.people.pageLabel", "페이지")} {page}/{pagesTotal}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="disabled:opacity-40"
              >
                ← {t("admin.people.prev", "이전")}
              </button>
              <span className="font-mono text-forest-800 font-semibold">{page}</span>
              <button
                disabled={page >= pagesTotal || loading}
                onClick={() => setPage(Math.min(pagesTotal, page + 1))}
                className="disabled:opacity-40"
              >
                {t("admin.people.next", "다음")} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function formatYYYYMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const getServerSideProps = adminSSR();
