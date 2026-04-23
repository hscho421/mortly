import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import AdminShell from "@/components/admin/AdminShell";
import {
  ABadge,
  ABtn,
  ASectionHead,
  FilterChip,
} from "@/components/admin/primitives";
import type { Tone } from "@/components/admin/primitives/ABadge";
import { formatAge } from "@/lib/admin/inboxQueue";

/**
 * /admin/reports — two-pane. List on the left, investigation drawer on the right.
 * Filter chips above the list. Drawer holds reporter/target cards, report text,
 * admin notes textarea, and resolution actions.
 *
 * API constraint: the schema's ReportStatus enum is OPEN|REVIEWED|RESOLVED|DISMISSED
 * but the PUT /api/admin/reports/[id] handler only accepts PENDING|REVIEWING|RESOLVED|
 * DISMISSED. So we wire RESOLVED and DISMISSED; "REVIEWED" toggling is deferred
 * to a follow-up where the handler can be aligned with the schema.
 */

type StatusFilter = "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED" | "ALL";
type TargetFilter = "ALL" | "BROKER" | "REQUEST" | "CONVERSATION";

interface ReportRow {
  id: string;
  reason: string;
  status: "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  targetType: string;
  targetId: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string };
}

interface ReportDetail extends ReportRow {
  targetDetails: Record<string, unknown> | null;
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_TONE: Record<ReportRow["status"], Tone> = {
  OPEN: "danger",
  REVIEWED: "warn",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export default function AdminReportsPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [target, setTarget] = useState<TargetFilter>("ALL");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totalByStatus, setTotalByStatus] = useState({
    OPEN: 0,
    REVIEWED: 0,
    RESOLVED: 0,
    DISMISSED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (status !== "ALL") params.set("status", status);
    if (target !== "ALL") params.set("targetType", target);
    try {
      const r = await fetch(`/api/admin/reports?${params.toString()}`);
      if (!r.ok) return;
      const data = (await r.json()) as Paginated<ReportRow>;
      setRows(data.data);
      if (data.data.length > 0 && !selectedId) {
        setSelectedId(data.data[0].id);
      } else if (data.data.length === 0) {
        setSelectedId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [status, target, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch counts for each status tab (one extra round-trip per tab isn't great;
  // batched for simplicity — swap for a single /api/admin/reports/summary later).
  useEffect(() => {
    let cancelled = false;
    const statuses: Array<ReportRow["status"]> = ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"];
    Promise.all(
      statuses.map((s) =>
        fetch(`/api/admin/reports?status=${s}&limit=1`).then((r) =>
          r.ok ? (r.json() as Promise<Paginated<ReportRow>>) : null,
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next = { OPEN: 0, REVIEWED: 0, RESOLVED: 0, DISMISSED: 0 } as Record<ReportRow["status"], number>;
      results.forEach((res, i) => {
        if (res) next[statuses[i]] = res.pagination.total;
      });
      setTotalByStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch detail when selection changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setNotesDraft("");
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/admin/reports/${selectedId}`);
      if (!r.ok || cancelled) return;
      const data = (await r.json()) as ReportDetail;
      if (cancelled) return;
      setDetail(data);
      setNotesDraft(data.adminNotes || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Deep-link support: ?id=<reportId> opens that report.
  useEffect(() => {
    const q = router.query.id;
    if (typeof q === "string" && q !== selectedId) setSelectedId(q);
  }, [router.query.id, selectedId]);

  const selectRow = (id: string) => {
    setSelectedId(id);
    router.push(
      { pathname: router.pathname, query: { ...router.query, id } },
      undefined,
      { shallow: true, locale: router.locale },
    );
  };

  const persist = async (nextStatus: ReportRow["status"] | null) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (nextStatus) body.status = nextStatus;
      if (notesDraft !== (detail?.adminNotes || "")) body.adminNotes = notesDraft;
      if (Object.keys(body).length === 0) return;
      const r = await fetch(`/api/admin/reports/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({ error: "Failed" }));
        throw new Error(data.error || "Failed");
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => totalByStatus, [totalByStatus]);

  return (
    <AdminShell active="reports" pageTitle={t("admin.reports.pageTitle", "신고 · mortly admin")}>
      <div className="grid h-full min-h-0 grid-cols-[1fr_440px]">
        <div className="flex flex-col min-w-0 min-h-0 overflow-auto">
          <div className="px-7 pt-6 pr-5">
            <ASectionHead
              label={t("admin.nav.reports", "신고")}
              title={
                <>
                  {t("admin.reports.titlePrefix", "신고 ")}
                  <em className="italic text-error-700 not-italic">{counts.OPEN}{t("admin.reports.titleCount", "건")}</em>
                  {t("admin.reports.titleSuffix", " 미처리")}
                </>
              }
              subtitle={t(
                "admin.reports.subtitle",
                "신고 내역을 검토하고 조치를 결정하세요.",
              )}
              right={
                <ABtn size="sm" variant="ghost" disabled>
                  ⬇ CSV
                </ABtn>
              }
            />

            <div className="flex gap-1.5 pb-3 border-b border-cream-300 flex-wrap">
              <FilterChip label={t("admin.reports.status.open", "미처리")} count={counts.OPEN} active={status === "OPEN"} onClick={() => { setStatus("OPEN"); setSelectedId(null); }} />
              <FilterChip label={t("admin.reports.status.reviewed", "검토됨")} count={counts.REVIEWED} active={status === "REVIEWED"} onClick={() => { setStatus("REVIEWED"); setSelectedId(null); }} />
              <FilterChip label={t("admin.reports.status.resolved", "해결됨")} count={counts.RESOLVED} active={status === "RESOLVED"} onClick={() => { setStatus("RESOLVED"); setSelectedId(null); }} />
              <FilterChip label={t("admin.reports.status.dismissed", "기각")} count={counts.DISMISSED} active={status === "DISMISSED"} onClick={() => { setStatus("DISMISSED"); setSelectedId(null); }} />
              <FilterChip divider label="" />
              <FilterChip label={t("admin.reports.target.all", "전체")} active={target === "ALL"} onClick={() => setTarget("ALL")} />
              <FilterChip label={t("admin.reports.target.broker", "전문가")} active={target === "BROKER"} onClick={() => setTarget("BROKER")} />
              <FilterChip label={t("admin.reports.target.borrower", "신청인/요청")} active={target === "REQUEST"} onClick={() => setTarget("REQUEST")} />
              <FilterChip label={t("admin.reports.target.convo", "대화")} active={target === "CONVERSATION"} onClick={() => setTarget("CONVERSATION")} />
            </div>
          </div>

          <div className="px-7 pr-5 pb-10">
            {loading ? (
              <div className="p-10 text-center text-sm text-sage-500">{t("common.loading", "로딩 중…")}</div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-sage-500">
                {t("admin.reports.empty", "조건에 맞는 신고가 없습니다.")}
              </div>
            ) : (
              rows.map((r) => {
                const isSel = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRow(r.id)}
                    className={`w-full text-left grid grid-cols-[90px_1fr_auto] gap-3.5 items-center px-4 py-3.5 border-b border-cream-200 border-l-[3px] ${
                      isSel ? "bg-cream-50 border-l-error-600" : "border-l-transparent hover:bg-cream-50/50"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-sage-500">
                      REP-{r.id.slice(-4).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-forest-800">
                        {r.reporter.name || r.reporter.email} <span className="text-sage-500">→</span>{" "}
                        <span className="text-amber-700">{r.targetType}:{r.targetId}</span>
                      </div>
                      <div className="text-[12px] text-sage-500 mt-0.5 truncate">{r.reason}</div>
                    </div>
                    <div className="text-right">
                      <ABadge tone={STATUS_TONE[r.status]}>{r.status}</ABadge>
                      <div className="font-mono text-[10px] text-sage-500 mt-1">{formatAge(r.createdAt)} 전</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Drawer */}
        <div className="border-l border-cream-300 bg-cream-50 overflow-auto">
          {detail ? (
            <ReportDrawer
              detail={detail}
              notesDraft={notesDraft}
              onNotesChange={setNotesDraft}
              onPersist={persist}
              saving={saving}
            />
          ) : (
            <div className="p-10 text-center text-sm text-sage-500">
              {selectedId ? t("common.loading", "로딩 중…") : t("admin.reports.selectHint", "신고를 선택하면 세부 정보가 표시됩니다.")}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// ── Drawer ───────────────────────────────────────────────────

function ReportDrawer({
  detail,
  notesDraft,
  onNotesChange,
  onPersist,
  saving,
}: {
  detail: ReportDetail;
  notesDraft: string;
  onNotesChange: (s: string) => void;
  onPersist: (next: ReportRow["status"] | null) => void;
  saving: boolean;
}) {
  const { t } = useTranslation("common");
  const targetLabel =
    detail.targetType === "BROKER"
      ? "전문가"
      : detail.targetType === "REQUEST"
      ? "요청"
      : detail.targetType === "CONVERSATION"
      ? "대화"
      : detail.targetType;
  const targetLink =
    detail.targetType === "BROKER"
      ? `/admin/brokers/${detail.targetId}`
      : detail.targetType === "REQUEST"
      ? `/admin/requests/${detail.targetId}`
      : detail.targetType === "CONVERSATION"
      ? `/admin/conversations/${detail.targetId}`
      : null;

  return (
    <div className="p-6">
      <ABadge tone={STATUS_TONE[detail.status]}>{detail.status}</ABadge>
      <div className="font-display text-2xl font-semibold mt-2 leading-tight">
        {detail.reason}
      </div>
      <div className="font-mono text-[11px] text-sage-500 mt-1">
        REP-{detail.id.slice(-4).toUpperCase()} · {formatAge(detail.createdAt)} 전
      </div>

      <div className="mt-5 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-1.5">
          {t("admin.reports.drawer.reporter", "신고자")}
        </div>
        <div className="text-[13px] font-medium">
          {detail.reporter.name || detail.reporter.email}
        </div>
      </div>

      <div className="mt-3 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-1.5">
          {t("admin.reports.drawer.target", "신고 대상")}
        </div>
        <div className="text-[13px] font-medium">
          {targetLabel} · {detail.targetId}
        </div>
        {targetLink && (
          <div className="mt-2">
            <Link href={targetLink} className="btn-ghost !px-3 !py-1 !text-xs">
              {t("admin.reports.drawer.openTarget", "대상 페이지 열기")}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-3 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-1.5">
          {t("admin.reports.drawer.content", "신고 내용")}
        </div>
        <div className="text-[13px] text-forest-700/80 italic leading-relaxed">
          "{detail.reason}"
        </div>
      </div>

      <div className="mt-5">
        <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-2">
          {t("admin.reports.drawer.notes", "관리자 메모")}
        </div>
        <textarea
          value={notesDraft}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
          className="input-field !p-3 !text-sm"
          placeholder={t(
            "admin.reports.drawer.notesPlaceholder",
            "메모를 입력하세요. 조사 과정과 결정 이유를 기록…",
          )}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {detail.status !== "RESOLVED" && (
          <ABtn
            size="lg"
            variant="success"
            disabled={saving}
            onClick={() => onPersist("RESOLVED")}
            className="justify-center"
          >
            {t("admin.reports.drawer.resolve", "해결됨으로 표시")}
          </ABtn>
        )}
        <div className="flex gap-2">
          {detail.status !== "DISMISSED" && (
            <ABtn
              variant="ghost"
              disabled={saving}
              onClick={() => onPersist("DISMISSED")}
              className="flex-1 justify-center"
            >
              {t("admin.reports.drawer.dismiss", "기각")}
            </ABtn>
          )}
          <ABtn
            variant="subtle"
            disabled={saving || notesDraft === (detail.adminNotes || "")}
            onClick={() => onPersist(null)}
            className="flex-1 justify-center"
          >
            {t("admin.reports.drawer.saveNotes", "메모만 저장")}
          </ABtn>
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
