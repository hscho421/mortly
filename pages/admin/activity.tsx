import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { adminSSR } from "@/lib/admin/ssrAuth";
import AdminShell from "@/components/admin/AdminShell";
import { useToast } from "@/components/Toast";
import {
  ABadge,
  ABtn,
  ASectionHead,
  ADrawerError,
  AConfirmDialog,
  FilterChip,
} from "@/components/admin/primitives";
import type { Tone } from "@/components/admin/primitives/ABadge";
import { formatAge } from "@/lib/admin/inboxQueue";
import { jsonOrThrow, useDrawerResource } from "@/lib/admin/useDrawerResource";
import { useAdminUrlFilters, parseEnum } from "@/lib/admin/useAdminUrlFilters";
import { useAdminShortcuts } from "@/lib/admin/useAdminShortcuts";
import RequestDetails from "@/components/admin/RequestDetails";

/**
 * /admin/activity — unified feed of requests + conversations.
 * Request and conversation rows are interleaved by updatedAt.
 * Clicking a conversation populates the right drawer (no route change);
 * clicking a request navigates to the existing detail page.
 *
 * Linkable: ?type=CONV&id=<conversationId> opens the drawer on load.
 */

type TypeFilter = "ALL" | "REQ" | "CONV";
type StatusFilter = "ALL" | "ACTIVE" | "IN_PROGRESS" | "CLOSED" | "FLAGGED";

interface ConvoRow {
  id: string;
  publicId: string;
  status: "ACTIVE" | "CLOSED";
  updatedAt: string;
  borrower: { id: string; name: string | null; email: string };
  broker: {
    id: string;
    brokerageName: string;
    user: { id: string; name: string | null; email: string };
  };
  request: { id: string; province: string; city: string | null; status: string; mortgageCategory: string };
  messages: Array<{ body: string; createdAt: string; sender: { name: string | null } }>;
  _count: { messages: number };
}

interface RequestRow {
  id: string;
  publicId: string;
  status: "PENDING_APPROVAL" | "OPEN" | "IN_PROGRESS" | "CLOSED" | "EXPIRED" | "REJECTED";
  province: string;
  city: string | null;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  createdAt: string;
  updatedAt: string;
  borrower: { id: string; name: string | null; email: string };
  _count: { conversations: number };
}

type ActivityItem =
  | { kind: "REQ"; row: RequestRow }
  | { kind: "CONV"; row: ConvoRow };

interface Paginated<T> {
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

/** Shape returned by GET /api/admin/requests/[publicId] — a subset we use. */
interface RequestDetail {
  id: string;
  publicId: string;
  status: RequestRow["status"];
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  province: string;
  city: string | null;
  details: Record<string, unknown> | null;
  desiredTimeline: string | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  borrower: { id: string; name: string | null; email: string; status: string };
  conversations: Array<{
    id: string;
    publicId: string;
    status: "ACTIVE" | "CLOSED";
    broker: {
      id: string;
      brokerageName: string;
      user: { id: string; name: string | null; email: string };
    };
    _count: { messages: number };
  }>;
}

const STATUS_TONE: Record<string, Tone> = {
  OPEN: "accent",
  ACTIVE: "info",
  IN_PROGRESS: "warn",
  PENDING_APPROVAL: "warn",
  REJECTED: "danger",
  EXPIRED: "neutral",
  CLOSED: "neutral",
};

export default function AdminActivityPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedReqPublicId, setSelectedReqPublicId] = useState<string | null>(null);

  // URL-driven filters — Phase 5: shared hook replaces hand-rolled patchQuery.
  const { filters, patch: patchQuery } = useAdminUrlFilters((q) => ({
    type: parseEnum(q.type, ["REQ", "CONV"] as const, "ALL" as const),
    status: parseEnum(
      q.status,
      ["ACTIVE", "IN_PROGRESS", "CLOSED", "FLAGGED"] as const,
      "ALL" as const,
    ),
  }));
  const typeFilter: TypeFilter = filters.type;
  const statusFilter: StatusFilter = filters.status;

  const setTypeFilter = (v: TypeFilter) =>
    patchQuery({ type: v === "ALL" ? null : v });
  const setStatusFilter = (v: StatusFilter) =>
    patchQuery({ status: v === "ALL" ? null : v });

  // Drawer state via useDrawerResource — gives us idle/loading/error/ready
  // branches so 404s render a real error panel instead of a stuck skeleton.
  type ConvDrawerData = ConvoRow & {
    messages: Array<{
      id: string;
      body: string;
      createdAt: string;
      senderId: string;
      sender: { id: string; name: string | null; email: string; role: string };
    }>;
  };

  const [convDrawerState, convDrawerCtl] = useDrawerResource<ConvDrawerData>(
    selectedConvId,
    (id) => fetch(`/api/admin/conversations/${id}`).then(jsonOrThrow<ConvDrawerData>),
  );
  const [reqDrawerState, reqDrawerCtl] = useDrawerResource<RequestDetail>(
    selectedReqPublicId,
    (id) => fetch(`/api/admin/requests/${id}`).then(jsonOrThrow<RequestDetail>),
  );

  // Pagination — "Load more" appends the next page from each stream.
  // `page` is 1-indexed and shared across both streams for simplicity.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      const setStateLoading = append ? setLoadingMore : setLoading;
      setStateLoading(true);
      try {
        const [reqRes, convRes] = await Promise.all([
          fetch(`/api/admin/requests?limit=${PAGE_SIZE}&page=${targetPage}`),
          fetch(`/api/admin/conversations?limit=${PAGE_SIZE}&page=${targetPage}`),
        ]);
        const reqs: Paginated<RequestRow> = reqRes.ok ? await reqRes.json() : { data: [] };
        const convs: Paginated<ConvoRow> = convRes.ok ? await convRes.json() : { data: [] };
        const fresh: ActivityItem[] = [
          ...reqs.data.map<ActivityItem>((r) => ({ kind: "REQ", row: r })),
          ...convs.data.map<ActivityItem>((c) => ({ kind: "CONV", row: c })),
        ];
        fresh.sort((a, b) => b.row.updatedAt.localeCompare(a.row.updatedAt));
        setItems((prev) => (append ? [...prev, ...fresh] : fresh));
        // More available iff either stream reports more pages OR returned a full page.
        const reqMore =
          (reqs.pagination?.totalPages ?? 0) > targetPage || reqs.data.length === PAGE_SIZE;
        const convMore =
          (convs.pagination?.totalPages ?? 0) > targetPage || convs.data.length === PAGE_SIZE;
        setHasMore(reqMore || convMore);
      } finally {
        setStateLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  };

  // Pick up ?id=<conversationId> and ?req=<publicId> deep links.
  // Selecting one clears the other so only one drawer is ever open.
  useEffect(() => {
    const id = router.query.id;
    if (typeof id === "string" && id !== selectedConvId) {
      setSelectedConvId(id);
      setSelectedReqPublicId(null);
    } else if (id == null && selectedConvId) {
      setSelectedConvId(null);
    }
  }, [router.query.id, selectedConvId]);

  useEffect(() => {
    const req = router.query.req;
    if (typeof req === "string" && req !== selectedReqPublicId) {
      setSelectedReqPublicId(req);
      setSelectedConvId(null);
    } else if (req == null && selectedReqPublicId) {
      setSelectedReqPublicId(null);
    }
  }, [router.query.req, selectedReqPublicId]);

  // (drawer fetching lives in useDrawerResource above — no useEffects needed.)

  const openConversation = (conv: ConvoRow) => {
    setSelectedConvId(conv.id);
    setSelectedReqPublicId(null);
    // Update URL so drawer state survives refresh.
    const { req: _req, ...rest } = router.query;
    router.push(
      { pathname: router.pathname, query: { ...rest, id: conv.id } },
      undefined,
      { shallow: true, locale: router.locale },
    );
  };

  const openRequest = (request: RequestRow) => {
    setSelectedReqPublicId(request.publicId);
    setSelectedConvId(null);
    const { id: _id, ...rest } = router.query;
    router.push(
      { pathname: router.pathname, query: { ...rest, req: request.publicId } },
      undefined,
      { shallow: true, locale: router.locale },
    );
  };

  const closeDrawer = () => {
    setSelectedConvId(null);
    setSelectedReqPublicId(null);
    const { id: _omit, req: _omit2, ...rest } = router.query;
    router.push({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
      locale: router.locale,
    });
  };

  // ── Dialog state for close + reject actions ─────────────
  // Phase 6: replaces window.prompt. Flow:
  //   1. click "종료" / "반려" → opens AConfirmDialog with reason textarea
  //   2. user types reason + confirms → runs the mutation
  //   3. on error → toast; on success → drawer + feed update
  const [pendingDialog, setPendingDialog] = useState<
    | null
    | { kind: "closeConv" }
    | { kind: "rejectReq" }
  >(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  const adminCloseConversation = async (reason: string | null) => {
    if (convDrawerState.state !== "ready") return;
    const current = convDrawerState.data;
    setDialogSaving(true);
    try {
      const r = await fetch(`/api/admin/conversations/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED", reason: reason ?? undefined }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast(data.error || "Failed", "error");
        return;
      }
      convDrawerCtl.setData({ ...current, status: "CLOSED" });
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "CONV" && it.row.id === current.id
            ? { ...it, row: { ...it.row, status: "CLOSED" as const } }
            : it,
        ),
      );
    } finally {
      setDialogSaving(false);
      setPendingDialog(null);
    }
  };

  const visible = useMemo(() => {
    let list = items;
    if (typeFilter !== "ALL") list = list.filter((it) => it.kind === typeFilter);
    if (statusFilter !== "ALL") {
      list = list.filter((it) => {
        if (it.kind === "CONV") return it.row.status === statusFilter;
        return it.row.status === statusFilter;
      });
    }
    return list;
  }, [items, typeFilter, statusFilter]);

  const counts = useMemo(() => {
    let all = 0, req = 0, conv = 0;
    items.forEach((it) => {
      all += 1;
      if (it.kind === "REQ") req += 1;
      else conv += 1;
    });
    return { all, req, conv };
  }, [items]);

  const showDrawer = Boolean(selectedConvId) || Boolean(selectedReqPublicId);
  const drawerKey = selectedConvId || selectedReqPublicId || "drawer";

  // Keyboard navigation across the visible feed. Current cursor is whichever
  // item has an open drawer; J/K move within `visible`, Enter re-opens.
  const activeIdx = (() => {
    for (let i = 0; i < visible.length; i++) {
      const v = visible[i];
      if (v.kind === "CONV" && v.row.id === selectedConvId) return i;
      if (v.kind === "REQ" && v.row.publicId === selectedReqPublicId) return i;
    }
    return -1;
  })();
  const activeIdxRef = useRef(activeIdx);
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  });
  useAdminShortcuts([
    {
      key: ["j", "ArrowDown"],
      handler: () => {
        const next = Math.min(activeIdxRef.current + 1, visible.length - 1);
        const v = visible[next];
        if (!v) return;
        if (v.kind === "CONV") openConversation(v.row);
        else openRequest(v.row);
      },
    },
    {
      key: ["k", "ArrowUp"],
      handler: () => {
        const next = Math.max(activeIdxRef.current - 1, 0);
        const v = visible[next];
        if (!v) return;
        if (v.kind === "CONV") openConversation(v.row);
        else openRequest(v.row);
      },
    },
  ]);

  const approveRequest = async () => {
    if (reqDrawerState.state !== "ready") return;
    const current = reqDrawerState.data;
    const r = await fetch(`/api/admin/requests/${current.publicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OPEN" }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      toast(data.error || "Failed", "error");
      return;
    }
    const updated = await r.json();
    reqDrawerCtl.setData({ ...current, status: updated.status });
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "REQ" && it.row.publicId === current.publicId
          ? { ...it, row: { ...it.row, status: updated.status } }
          : it,
      ),
    );
  };

  const rejectRequest = async (reason: string | null) => {
    if (reqDrawerState.state !== "ready") return;
    const current = reqDrawerState.data;
    setDialogSaving(true);
    try {
      const r = await fetch(`/api/admin/requests/${current.publicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          ...(reason ? { reason } : {}),
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast(data.error || "Failed", "error");
        return;
      }
      const updated = await r.json();
      reqDrawerCtl.setData({ ...current, status: updated.status });
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "REQ" && it.row.publicId === current.publicId
            ? { ...it, row: { ...it.row, status: updated.status } }
            : it,
        ),
      );
    } finally {
      setDialogSaving(false);
      setPendingDialog(null);
    }
  };

  return (
    <AdminShell active="activity" pageTitle={t("admin.activity.pageTitle", "활동 · mortly admin")}>
      <div
        className={`grid h-full min-h-0 ${showDrawer ? "grid-cols-[1fr_520px]" : "grid-cols-1"}`}
      >
        <div className="flex flex-col min-w-0 min-h-0 overflow-auto">
          <div className="px-7 pt-6 pr-5">
            <ASectionHead
              label={t("admin.nav.activity", "활동")}
              title={t("admin.activity.title", "상담 요청 · 대화")}
              subtitle={t("admin.activity.subtitle", "최근 요청과 대화를 한 피드에서 확인하세요.")}
              right={
                <ABtn size="sm" variant="ghost" disabled>
                  ⬇ CSV
                </ABtn>
              }
            />
            <div className="flex items-center gap-1.5 mt-4 pb-3 border-b border-cream-300 flex-wrap">
              <FilterChip label={t("admin.activity.filter.all", "전체")} count={counts.all} active={typeFilter === "ALL"} onClick={() => setTypeFilter("ALL")} />
              <FilterChip label={t("admin.activity.filter.requests", "요청")} count={counts.req} active={typeFilter === "REQ"} onClick={() => setTypeFilter("REQ")} />
              <FilterChip label={t("admin.activity.filter.convos", "대화")} count={counts.conv} active={typeFilter === "CONV"} onClick={() => setTypeFilter("CONV")} />
              <FilterChip divider label="" />
              <FilterChip label={t("admin.activity.status.all", "전체 상태")} active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
              <FilterChip label={t("admin.activity.status.active", "활성")} active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} />
              <FilterChip label={t("admin.activity.status.inProgress", "진행 중")} active={statusFilter === "IN_PROGRESS"} onClick={() => setStatusFilter("IN_PROGRESS")} />
              <FilterChip label={t("admin.activity.status.closed", "종료")} active={statusFilter === "CLOSED"} onClick={() => setStatusFilter("CLOSED")} />
            </div>
          </div>

          <div className="px-7 pb-10 pr-5">
            {loading ? (
              <div className="p-10 text-center text-sm text-sage-500">{t("common.loading", "로딩 중…")}</div>
            ) : visible.length === 0 ? (
              <div className="p-10 text-center text-sm text-sage-500">
                {t("admin.activity.empty", "조건에 맞는 활동이 없습니다.")}
              </div>
            ) : (
              <>
                {visible.map((it) => (
                  <ActivityRow
                    key={`${it.kind}-${it.row.id}`}
                    item={it}
                    selected={
                      (it.kind === "CONV" && it.row.id === selectedConvId) ||
                      (it.kind === "REQ" && it.row.publicId === selectedReqPublicId)
                    }
                    onOpen={() => {
                      if (it.kind === "CONV") openConversation(it.row);
                      else openRequest(it.row);
                    }}
                  />
                ))}
                {hasMore && (
                  <div className="py-4 text-center">
                    <ABtn
                      size="sm"
                      variant="ghost"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? t("common.loading", "로딩 중…")
                        : t("admin.activity.loadMore", "더 불러오기")}
                    </ABtn>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showDrawer && (
          <div
            key={drawerKey}
            className="border-l border-cream-300 bg-cream-50 flex flex-col min-h-0"
          >
            {selectedConvId ? (
              convDrawerState.state === "ready" ? (
                <ConversationDrawer
                  conv={convDrawerState.data}
                  messages={convDrawerState.data.messages || []}
                  onClose={closeDrawer}
                  onAdminClose={() => setPendingDialog({ kind: "closeConv" })}
                />
              ) : convDrawerState.state === "error" ? (
                <ADrawerError
                  title={t("admin.activity.drawer.errorTitle", "대화를 불러올 수 없습니다")}
                  message={convDrawerState.message}
                  onRetry={convDrawerState.retry}
                />
              ) : (
                <DrawerSkeleton />
              )
            ) : reqDrawerState.state === "ready" ? (
              <RequestDrawer
                detail={reqDrawerState.data}
                onClose={closeDrawer}
                onApprove={approveRequest}
                onReject={() => setPendingDialog({ kind: "rejectReq" })}
                onOpenConversation={(convId) => {
                  setSelectedReqPublicId(null);
                  setSelectedConvId(convId);
                  const { req: _req, ...rest } = router.query;
                  router.push(
                    { pathname: router.pathname, query: { ...rest, id: convId } },
                    undefined,
                    { shallow: true, locale: router.locale },
                  );
                }}
              />
            ) : reqDrawerState.state === "error" ? (
              <ADrawerError
                title={t("admin.activity.reqDrawer.errorTitle", "요청을 불러올 수 없습니다")}
                message={reqDrawerState.message}
                onRetry={reqDrawerState.retry}
              />
            ) : (
              <DrawerSkeleton />
            )}
          </div>
        )}
      </div>

      {pendingDialog?.kind === "closeConv" && (
        <AConfirmDialog
          open
          onClose={() => setPendingDialog(null)}
          tone="danger"
          title={t("admin.activity.closeDialog.title", "대화 종료")}
          description={t(
            "admin.activity.closeDialog.body",
            "이 대화를 종료합니다. 양 당사자에게 관리자 종료 메시지가 전달됩니다.",
          )}
          requireReason="optional"
          reasonLabel={t("admin.activity.closeDialog.reasonLabel", "종료 사유")}
          reasonPlaceholder={t(
            "admin.activity.closeDialog.reasonPlaceholder",
            "예: 스팸, 욕설, 중복 문의…",
          )}
          confirmLabel={t("admin.activity.closeDialog.confirm", "종료")}
          onConfirm={adminCloseConversation}
          loading={dialogSaving}
        />
      )}

      {pendingDialog?.kind === "rejectReq" && (
        <AConfirmDialog
          open
          onClose={() => setPendingDialog(null)}
          tone="danger"
          title={t("admin.activity.rejectDialog.title", "상담 요청 반려")}
          description={t(
            "admin.activity.rejectDialog.body",
            "이 요청을 반려합니다. 사유는 신청인에게 표시됩니다.",
          )}
          requireReason="optional"
          reasonLabel={t("admin.activity.rejectDialog.reasonLabel", "반려 사유")}
          reasonPlaceholder={t(
            "admin.activity.rejectDialog.reasonPlaceholder",
            "예: 정보 부족, 중복 요청…",
          )}
          confirmLabel={t("admin.activity.rejectDialog.confirm", "반려")}
          onConfirm={rejectRequest}
          loading={dialogSaving}
        />
      )}
    </AdminShell>
  );
}

// ── Row ─────────────────────────────────────────────────────

const ActivityRow = memo(function ActivityRow({
  item,
  selected,
  onOpen,
}: {
  item: ActivityItem;
  selected: boolean;
  onOpen: () => void;
}) {
  if (item.kind === "REQ") {
    const r = item.row;
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left grid grid-cols-[48px_90px_1fr_auto] gap-3.5 items-center px-4 py-3.5 border-b border-cream-200 border-l-[3px] ${
          selected ? "bg-cream-50 border-l-amber-500" : "border-l-transparent hover:bg-cream-50/50"
        }`}
      >
        <ABadge tone="accent">REQ</ABadge>
        <span className="font-mono text-[10px] text-sage-500">{r.publicId}</span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-forest-800 truncate">
            {r.borrower.name || r.borrower.email} · {r._count.conversations} 전문가 응답
          </div>
          <div className="text-[11px] text-sage-500 mt-0.5 truncate">
            {[r.city, r.province].filter(Boolean).join(", ")} · {r.mortgageCategory === "COMMERCIAL" ? "상업용" : "주거용"}
          </div>
        </div>
        <div className="text-right">
          <ABadge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</ABadge>
          <div className="font-mono text-[10px] text-sage-500 mt-1">{formatAge(r.updatedAt)} 전</div>
        </div>
      </button>
    );
  }
  const c = item.row;
  const lastMsg = c.messages[0];
  const other = c.borrower.name || c.borrower.email;
  const broker = c.broker.user.name || c.broker.brokerageName;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left grid grid-cols-[48px_90px_1fr_auto] gap-3.5 items-center px-4 py-3.5 border-b border-cream-200 border-l-[3px] ${
        selected ? "bg-cream-50 border-l-amber-500" : "border-l-transparent hover:bg-cream-50/50"
      }`}
    >
      <ABadge tone="info">CONV</ABadge>
      <span className="font-mono text-[10px] text-sage-500">{c.publicId}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-forest-800 truncate">
          {other} ↔ {broker}
        </div>
        <div className="text-[11px] text-sage-500 mt-0.5 truncate">
          {c._count.messages} 메시지
          {lastMsg && (
            <span className="italic text-sage-400">
              {" · "}
              {lastMsg.sender.name || "—"}: "{truncate(lastMsg.body, 48)}"
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <ABadge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</ABadge>
        <div className="font-mono text-[10px] text-sage-500 mt-1">{formatAge(c.updatedAt)} 전</div>
      </div>
    </button>
  );
});

// ── Drawer skeleton ────────────────────────────────────────
// Shown while switching between conversations so the old messages don't
// linger during the fetch. Matches the real drawer's section layout so the
// transition feels like hydration instead of a content swap.

function DrawerSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-cream-300">
        <div className="h-4 w-20 bg-cream-200 rounded-sm animate-pulse" />
        <div className="h-5 w-56 bg-cream-200 rounded-sm mt-2 animate-pulse" />
        <div className="h-3 w-40 bg-cream-200 rounded-sm mt-1.5 animate-pulse" />
      </div>
      {/* Meta bar */}
      <div className="px-5 py-3 border-b border-cream-300 bg-cream-100">
        <div className="h-3 w-48 bg-cream-200 rounded-sm animate-pulse" />
      </div>
      {/* Message list */}
      <div className="flex-1 overflow-hidden p-5 bg-cream-100 space-y-3">
        {[true, false, true, false, true].map((left, i) => (
          <div key={i} className={`flex ${left ? "justify-start" : "justify-end"}`}>
            <div
              className={`p-2.5 border rounded-sm animate-pulse ${left ? "bg-cream-50 border-cream-300" : "bg-amber-50 border-amber-200"}`}
              style={{ width: `${35 + (i % 3) * 20}%` }}
            >
              <div className="h-2.5 w-16 bg-cream-200 rounded-sm" />
              <div className="h-3 w-full bg-cream-200 rounded-sm mt-2" />
              {i % 2 === 0 && <div className="h-3 w-3/4 bg-cream-200 rounded-sm mt-1.5" />}
            </div>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-cream-300 bg-cream-50">
        <div className="h-2.5 w-40 bg-cream-200 rounded-sm mx-auto animate-pulse" />
      </div>
    </>
  );
}

// ── Request drawer ─────────────────────────────────────────

function RequestDrawer({
  detail,
  onClose,
  onApprove,
  onReject,
  onOpenConversation,
}: {
  detail: RequestDetail;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpenConversation: (convId: string) => void;
}) {
  const { t } = useTranslation("common");
  const tone: Tone =
    detail.status === "OPEN"
      ? "accent"
      : detail.status === "IN_PROGRESS"
      ? "warn"
      : detail.status === "PENDING_APPROVAL"
      ? "warn"
      : detail.status === "REJECTED"
      ? "danger"
      : "neutral";

  return (
    <>
      <div className="px-5 py-4 border-b border-cream-300 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ABadge tone={tone}>{detail.status}</ABadge>
          <div className="font-display text-lg font-semibold mt-1.5 truncate">
            {detail.borrower.name || detail.borrower.email} · {detail.mortgageCategory === "COMMERCIAL" ? "상업용" : "주거용"}
          </div>
          <div className="font-mono text-[11px] text-sage-500 mt-0.5 truncate">
            REQ · {detail.publicId}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <ABtn size="sm" variant="ghost" onClick={onClose}>
            {t("common.close", "닫기")}
          </ABtn>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <RequestDetails
          mortgageCategory={detail.mortgageCategory}
          productTypes={detail.productTypes}
          province={detail.province}
          city={detail.city}
          desiredTimeline={detail.desiredTimeline}
          notes={detail.notes}
          rejectionReason={detail.rejectionReason}
          details={detail.details}
        />

        {/* Borrower */}
        <div className="mt-4 p-3.5 bg-cream-100 border border-cream-300">
          <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest mb-1">신청인</div>
          <div className="text-[13px] font-medium">{detail.borrower.name || detail.borrower.email}</div>
          <div className="text-[12px] text-sage-500 mt-0.5">{detail.borrower.email} · {detail.borrower.status}</div>
          <div className="mt-2">
            <Link href={`/admin/users/${detail.borrower.id}`} className="btn-ghost !px-3 !py-1 !text-xs">
              {t("admin.activity.reqDrawer.openBorrower", "신청인 페이지 열기")}
            </Link>
          </div>
        </div>

        {/* Conversations */}
        <div className="mt-4">
          <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-2">
            {t("admin.activity.reqDrawer.conversations", "전문가 응답")} · {detail.conversations.length}
          </div>
          {detail.conversations.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-sage-500 border border-dashed border-cream-300">
              {t("admin.activity.reqDrawer.noConvos", "아직 응답한 전문가가 없습니다.")}
            </div>
          ) : (
            detail.conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenConversation(c.id)}
                className="w-full text-left grid grid-cols-[1fr_auto] gap-3 items-center px-3.5 py-2.5 border border-cream-300 hover:border-forest-300 mb-1.5 bg-cream-50"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {c.broker.user.name || c.broker.brokerageName}
                  </div>
                  <div className="text-[11px] text-sage-500 mt-0.5 font-mono truncate">
                    {c.publicId} · {c._count.messages} {t("admin.activity.drawer.messages", "메시지")}
                  </div>
                </div>
                <ABadge tone={c.status === "ACTIVE" ? "info" : "neutral"}>{c.status}</ABadge>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Approve / reject on PENDING_APPROVAL only */}
      {detail.status === "PENDING_APPROVAL" && (
        <div className="px-5 py-3 border-t border-cream-300 bg-cream-50 flex gap-2">
          <ABtn size="lg" variant="success" className="flex-1 justify-center" onClick={onApprove}>
            ✓ {t("admin.inbox.kb.approve", "승인")}
          </ABtn>
          <ABtn size="lg" variant="ghost" onClick={onReject} className="!text-error-700 !border-error-100">
            {t("admin.inbox.kb.reject", "반려")}
          </ABtn>
        </div>
      )}
    </>
  );
}

// ── Conversation drawer ────────────────────────────────────

function ConversationDrawer({
  conv,
  messages,
  onClose,
  onAdminClose,
}: {
  conv: ConvoRow;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    sender: { id: string; name: string | null; email: string; role: string };
  }>;
  onClose: () => void;
  onAdminClose: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <>
      <div className="px-5 py-4 border-b border-cream-300 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ABadge tone={conv.status === "ACTIVE" ? "info" : "neutral"}>
            {conv.status === "ACTIVE" ? t("admin.activity.drawer.active", "활성 대화") : t("admin.activity.drawer.closed", "종료된 대화")}
          </ABadge>
          <div className="font-display text-lg font-semibold mt-1.5 truncate">
            {(conv.borrower.name || conv.borrower.email)} ↔ {(conv.broker.user.name || conv.broker.brokerageName)}
          </div>
          <div className="font-mono text-[11px] text-sage-500 mt-0.5 truncate">
            {conv.publicId} ·{" "}
            <Link href={`/admin/conversations/${conv.publicId}`} className="underline decoration-dotted underline-offset-2 hover:text-forest-800">
              {t("admin.activity.drawer.openFull", "전체 페이지로 열기")}
            </Link>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {conv.status === "ACTIVE" && (
            <ABtn size="sm" variant="ghost" onClick={onAdminClose} className="!text-error-700 !border-error-100">
              {t("admin.activity.drawer.close", "대화 종료")}
            </ABtn>
          )}
          <ABtn size="sm" variant="ghost" onClick={onClose}>
            {t("common.close", "닫기")}
          </ABtn>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-cream-300 bg-cream-100 font-mono text-[11px] text-sage-500 flex gap-3">
        <span>{messages.length} {t("admin.activity.drawer.messages", "메시지")}</span>
        <span>·</span>
        <span className="truncate">
          {t("admin.activity.drawer.request", "요청")}:{" "}
          {[conv.request.city, conv.request.province].filter(Boolean).join(", ")}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-5 bg-cream-100">
        {messages.length === 0 && (
          <div className="text-center text-sm text-sage-500 py-10">
            {t("admin.activity.drawer.noMessages", "메시지가 없습니다.")}
          </div>
        )}
        {messages.map((m) => {
          const isBorrower = m.senderId === conv.borrower.id;
          return (
            <div
              key={m.id}
              className={`mb-3 flex ${isBorrower ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[78%] p-2.5 border rounded-sm ${isBorrower ? "bg-cream-50 border-cream-300" : "bg-amber-50 border-amber-200"}`}
              >
                <div className="font-mono text-[10px] text-sage-500 mb-1">
                  {m.sender.name || m.sender.email} · {formatHM(m.createdAt)}
                </div>
                <div className="text-[13px] text-forest-800 leading-relaxed whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-2.5 border-t border-cream-300 bg-cream-50 font-mono text-[10px] text-sage-500 text-center">
        {t("admin.activity.drawer.readOnlyHint", "관리자는 읽기 전용")}
      </div>
    </>
  );
}

// ── helpers ─────────────────────────────────────────────────

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function formatHM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const getServerSideProps = adminSSR();
