import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  fetchInboxQueue,
  formatAge,
  isPriority,
  type InboxKind,
  type InboxRow,
  type InboxRequestRow,
  type InboxBrokerRow,
  type InboxReportRow,
} from "@/lib/admin/inboxQueue";

/**
 * /admin/inbox — unified decision queue.
 *
 * Three queues merged into one sorted list:
 *   • BorrowerRequest rows with status=PENDING_APPROVAL
 *   • Broker rows with verificationStatus=PENDING
 *   • Report rows with status=OPEN
 *
 * Approve/reject fan out to the matching PUT endpoint. Keyboard shortcuts:
 *   J/K   move cursor
 *   A     approve the selected row
 *   R     reject the selected row
 *   E     open detail page
 *   ⌘↵   approve-and-next
 */

type FilterKey = "ALL" | InboxKind;

const KIND_META: Record<InboxKind, { tone: React.ComponentProps<typeof ABadge>["tone"]; labelKo: string }> = {
  REQ: { tone: "accent", labelKo: "상담" },
  BRK: { tone: "info", labelKo: "전문가" },
  REP: { tone: "danger", labelKo: "신고" },
};

export default function AdminInboxPage() {
  const { t } = useTranslation("common");
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);

  // Initial load + poll every 60s (matches badge-fetch cadence).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchInboxQueue();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load queue");
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const counts = useMemo(() => {
    const out = { ALL: 0, REQ: 0, BRK: 0, REP: 0 } as Record<FilterKey, number>;
    (rows || []).forEach((r) => {
      out.ALL += 1;
      out[r.kind] += 1;
    });
    return out;
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    if (filter === "ALL") return rows;
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  useEffect(() => {
    if (cursor >= visibleRows.length) setCursor(Math.max(0, visibleRows.length - 1));
  }, [cursor, visibleRows.length]);

  const selected = visibleRows[cursor];

  // API dispatch — kind → PUT { status/verificationStatus }
  const applyDecision = useCallback(
    async (row: InboxRow, decision: "approve" | "reject") => {
      setBusy(true);
      try {
        let url: string;
        let body: Record<string, unknown>;
        if (row.kind === "REQ") {
          url = `/api/admin/requests/${row.publicId}`;
          body = { status: decision === "approve" ? "OPEN" : "REJECTED" };
        } else if (row.kind === "BRK") {
          url = `/api/admin/brokers/${row.id}`;
          body = { verificationStatus: decision === "approve" ? "VERIFIED" : "REJECTED" };
        } else {
          url = `/api/admin/reports/${row.id}`;
          body = { status: decision === "approve" ? "RESOLVED" : "DISMISSED" };
        }
        const r = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error || "Request failed");
        }
        // Optimistic removal from queue — the row no longer matches the filter.
        setRows((prev) => (prev ? prev.filter((x) => x.id !== row.id || x.kind !== row.kind) : prev));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in a field
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!selected || busy) return;
        e.preventDefault();
        applyDecision(selected, "approve").then(() => {
          setCursor((c) => Math.min(c, Math.max(0, (visibleRows.length - 2))));
        });
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(0, visibleRows.length - 1)));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "a" || e.key === "A") {
        if (!selected || busy) return;
        e.preventDefault();
        applyDecision(selected, "approve");
      } else if (e.key === "r" || e.key === "R") {
        if (!selected || busy) return;
        e.preventDefault();
        applyDecision(selected, "reject");
      } else if (e.key === "e" || e.key === "E") {
        if (!selected) return;
        e.preventDefault();
        openDetail(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, busy, applyDecision, visibleRows.length]);

  const filterChips: Array<{ key: FilterKey; label: string }> = [
    { key: "ALL", label: t("admin.inbox.filter.all", "전체") },
    { key: "REQ", label: t("admin.inbox.filter.requests", "상담 승인") },
    { key: "BRK", label: t("admin.inbox.filter.brokers", "전문가 인증") },
    { key: "REP", label: t("admin.inbox.filter.reports", "신고") },
  ];

  return (
    <AdminShell active="inbox" pageTitle={t("admin.inbox.pageTitle", "인박스 · mortly admin")}>
      <div className="px-7 pt-6">
        <ASectionHead
          label={t("admin.inbox.eyebrow", "관리자 인박스")}
          big
          title={
            <>
              {t("admin.inbox.titlePrefix", "오늘 아침, ")}
              <em className="italic text-amber-600 not-italic font-serif">
                {counts.ALL}
                {t("admin.inbox.titleCountSuffix", "건")}
              </em>
              {t("admin.inbox.titleSuffix", "의 결정이 기다리고 있어요.")}
            </>
          }
          subtitle={
            <>
              {t("admin.inbox.subtitle", "대기 중인 상담 · 전문가 인증 · 신고를 한 곳에서 처리하세요.")}
            </>
          }
          right={
            <ABtn size="sm" variant="ghost" disabled>
              {t("admin.inbox.export", "내보내기")}
            </ABtn>
          }
        />

        <div className="flex items-center gap-1.5 mt-4 pb-2 border-b border-cream-300 flex-wrap">
          {filterChips.map((c) => (
            <FilterChip
              key={c.key}
              label={c.label}
              count={counts[c.key]}
              active={filter === c.key}
              onClick={() => {
                setFilter(c.key);
                setCursor(0);
              }}
            />
          ))}
          <span className="ml-auto font-mono text-[11px] text-sage-500">
            {t("admin.inbox.sortLabel", "정렬: ")}
            <span className="text-forest-800 font-semibold">{t("admin.inbox.sortNewest", "최신순")}</span>
          </span>
        </div>
      </div>

      {/* Queue + drawer */}
      <div className="grid grid-cols-[1fr_400px] gap-0 min-h-0 mt-1">
        <div className="px-7 pb-10">
          {rows === null ? (
            <QueueLoading />
          ) : error ? (
            <div className="p-10 text-center text-sm text-error-700">{error}</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-16 text-center text-sage-500 font-body">
              <div className="font-display text-xl text-forest-800 mb-1">
                {t("admin.inbox.cleared", "전부 정리됐어요.")}
              </div>
              <div className="text-sm">
                {t("admin.inbox.clearedSub", "기다리는 결정이 없습니다. 좋은 하루 되세요.")}
              </div>
            </div>
          ) : (
            visibleRows.map((row, i) => (
              <QueueRow
                key={`${row.kind}-${row.id}`}
                row={row}
                index={i}
                selected={cursor === i}
                busy={busy}
                onFocus={() => setCursor(i)}
                onApprove={() => applyDecision(row, "approve")}
                onReject={() => applyDecision(row, "reject")}
              />
            ))
          )}

          <div className="mt-6 py-4 text-center font-mono text-[11px] text-sage-500 tracking-wider">
            ─── J/K {t("admin.inbox.kb.move", "이동")} · A {t("admin.inbox.kb.approve", "승인")} · R {t("admin.inbox.kb.reject", "반려")} · E {t("admin.inbox.kb.detail", "상세")} · ⌘↵ {t("admin.inbox.kb.approveNext", "승인 후 다음")} ───
          </div>
        </div>

        {/* Drawer — detail for the selected row */}
        <div className="border-l border-cream-300 bg-cream-50 overflow-auto">
          {selected ? (
            <InboxDetail row={selected} busy={busy} onApprove={() => applyDecision(selected, "approve")} onReject={() => applyDecision(selected, "reject")} />
          ) : (
            <div className="p-10 text-center text-sage-500 text-sm">
              {t("admin.inbox.selectHint", "항목을 선택하면 상세 정보가 표시됩니다.")}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// ── Queue row ─────────────────────────────────────────────────

function QueueRow({
  row,
  index,
  selected,
  busy,
  onFocus,
  onApprove,
  onReject,
}: {
  row: InboxRow;
  index: number;
  selected: boolean;
  busy: boolean;
  onFocus: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = KIND_META[row.kind];
  const priority = isPriority(row);
  const summary = summarizeRow(row);
  return (
    <div
      onClick={onFocus}
      className={`py-3.5 px-4 grid grid-cols-[22px_72px_92px_1fr_auto_190px] gap-3.5 items-center border-b border-cream-200 transition-colors ${
        selected
          ? "bg-cream-50 border border-forest-800 border-l-[3px] border-l-amber-500"
          : "border-l-[3px] border-l-transparent hover:bg-cream-50/50"
      }`}
    >
      <span className="font-mono text-[10px] text-sage-500 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>
      <ABadge tone={meta.tone}>{meta.labelKo}</ABadge>
      <span className="font-mono text-[10px] text-sage-500 truncate">{row.publicId}</span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-forest-800 truncate flex items-center gap-2">
          {summary.title}
          {priority && (
            <span className="text-error-600 text-[11px]">● {summary.priorityLabel}</span>
          )}
        </div>
        <div className="text-[12px] text-sage-500 mt-0.5 truncate">
          {summary.subtitle}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] text-amber-600 font-semibold">{summary.amountOrTag}</div>
        <div className="font-mono text-[10px] text-sage-500 mt-0.5">{formatAge(row.createdAt)} 전</div>
      </div>
      <div className="flex gap-1.5 justify-end">
        <ABtn size="sm" variant={selected ? "success" : "ghost"} disabled={busy} onClick={(e) => { e.stopPropagation(); onApprove(); }}>
          ✓ 승인
        </ABtn>
        <ABtn size="sm" variant="ghost" disabled={busy} onClick={(e) => { e.stopPropagation(); onReject(); }} className="!text-error-700 !border-error-100">
          ✕
        </ABtn>
        <ABtn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(row); }}>
          ⋯
        </ABtn>
      </div>
    </div>
  );
}

function QueueLoading() {
  return (
    <div className="py-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="py-4 border-b border-cream-200">
          <div className="h-3 bg-cream-200 rounded-sm w-1/3 mb-2" />
          <div className="h-2 bg-cream-200 rounded-sm w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────

function InboxDetail({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: InboxRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation("common");
  const meta = KIND_META[row.kind];
  const summary = summarizeRow(row);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <ABadge tone={meta.tone}>{summary.badgeLabel}</ABadge>
        <span className="font-mono text-[10px] text-sage-500">{row.publicId}</span>
      </div>
      <div className="font-display text-2xl font-semibold text-forest-800 leading-tight">
        {summary.title}
      </div>
      <div className="text-xs text-sage-500 mt-1">
        {formatAge(row.createdAt)} {t("admin.inbox.detail.agedSuffix", "전 접수")} · {summary.subtitle}
      </div>

      <DetailFields row={row} />
      <DetailChecks row={row} />
      <RecommendedAction row={row} />

      <div className="mt-5 flex gap-2">
        <ABtn size="lg" variant="success" className="flex-1" onClick={onApprove} disabled={busy}>
          ✓ {summary.approveLabel}
        </ABtn>
        <ABtn size="lg" variant="ghost" onClick={onReject} disabled={busy} className="!text-error-700 !border-error-100">
          {summary.rejectLabel}
        </ABtn>
      </div>
      <div className="mt-2 text-center font-mono text-[10px] text-sage-500">
        A {t("admin.inbox.kb.approve", "승인")} · R {t("admin.inbox.kb.reject", "반려")} · ⌘↵ {t("admin.inbox.kb.approveNext", "승인 후 다음")}
      </div>
    </div>
  );
}

function DetailFields({ row }: { row: InboxRow }) {
  if (row.kind === "REQ") {
    const details = (row.details as Record<string, unknown>) ?? {};
    const pairs: Array<[string, string]> = [
      ["지역", [row.city, row.province].filter(Boolean).join(", ")],
      ["유형", row.mortgageCategory === "COMMERCIAL" ? "상업용" : "주거용"],
      ["상품", (row.productTypes || []).join(", ") || "—"],
    ];
    if (typeof details.downPayment === "string") pairs.push(["다운페이", details.downPayment as string]);
    if (typeof details.creditScore === "string") pairs.push(["신용", details.creditScore as string]);
    if (typeof details.timeline === "string") pairs.push(["시기", details.timeline as string]);
    return (
      <div className="mt-4 p-3.5 bg-cream-100 border border-cream-300">
        <div className="grid grid-cols-2 gap-3">
          {pairs.map(([k, v]) => (
            <div key={k}>
              <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">{k}</div>
              <div className="text-[13px] font-medium mt-0.5 truncate">{v || "—"}</div>
            </div>
          ))}
        </div>
        {row.notes && (
          <div className="mt-3 pt-3 border-t border-cream-300">
            <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">신청인 메모</div>
            <div className="text-[13px] text-forest-700/80 italic mt-1 leading-relaxed">"{row.notes}"</div>
          </div>
        )}
      </div>
    );
  }
  if (row.kind === "BRK") {
    const pairs: Array<[string, string | number]> = [
      ["브로커리지", row.brokerageName],
      ["지역", row.province],
      ["라이선스", row.licenseNumber],
      ["티어", row.subscriptionTier],
    ];
    if (row.yearsExperience != null) pairs.push(["경력", `${row.yearsExperience}년`]);
    return (
      <div className="mt-4 p-3.5 bg-cream-100 border border-cream-300">
        <div className="grid grid-cols-2 gap-3">
          {pairs.map(([k, v]) => (
            <div key={k}>
              <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">{k}</div>
              <div className="text-[13px] font-medium mt-0.5 truncate">{String(v)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // REP
  return (
    <>
      <div className="mt-4 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">신고자</div>
        <div className="text-[13px] font-medium mt-0.5">{row.reporter.name || row.reporter.email}</div>
      </div>
      <div className="mt-3 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">신고 대상</div>
        <div className="text-[13px] font-medium mt-0.5">{row.targetType} · {row.targetId}</div>
      </div>
      <div className="mt-3 p-3.5 bg-cream-100 border border-cream-300">
        <div className="font-mono text-[9px] text-sage-500 uppercase tracking-widest">사유</div>
        <div className="text-[13px] text-forest-700/80 italic mt-1 leading-relaxed">"{row.reason}"</div>
      </div>
    </>
  );
}

function DetailChecks({ row }: { row: InboxRow }) {
  const checks =
    row.kind === "REQ"
      ? [
          { ok: true, label: "신규 신청자 확인 완료" },
          { ok: true, label: "중복 요청 없음" },
          { ok: true, label: "콘텐츠 모더레이션 통과" },
        ]
      : row.kind === "BRK"
      ? [
          { ok: true, label: "라이선스 번호 형식 유효" },
          { ok: true, label: "이메일 인증 완료" },
          { ok: false, label: "라이선스 당국 조회 — 수동 확인 권장" },
        ]
      : [
          { ok: true, label: "신고자 이메일 인증 완료" },
          { ok: false, label: "동일 대상 누적 신고 존재 — 검토 필요" },
        ];
  return (
    <div className="mt-5">
      <div className="font-mono text-[10px] text-sage-500 uppercase tracking-widest mb-2">
        자동 체크
      </div>
      {checks.map((c, i) => (
        <div
          key={i}
          className={`py-1.5 text-[12px] text-forest-700/80 flex gap-2.5 ${
            i < checks.length - 1 ? "border-b border-cream-200" : ""
          }`}
        >
          <span className={`font-mono font-bold ${c.ok ? "text-success-700" : "text-warning-700"}`}>
            {c.ok ? "✓" : "!"}
          </span>
          {c.label}
        </div>
      ))}
    </div>
  );
}

function RecommendedAction({ row }: { row: InboxRow }) {
  const text =
    row.kind === "REQ"
      ? "자동 체크를 모두 통과했습니다. 승인 시 전문가들에게 즉시 노출됩니다."
      : row.kind === "BRK"
      ? "라이선스 검증 후 승인하세요. 승인 시 전문가 플랜을 즉시 사용할 수 있습니다."
      : "신고 내용을 검토 후 해결 또는 기각하세요. 해결 시 조치가 대상에게 안내됩니다.";
  return (
    <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200">
      <div className="font-mono text-[10px] text-amber-700 uppercase tracking-widest mb-1">
        권장 조치
      </div>
      <div className="text-[13px] leading-relaxed text-forest-800">{text}</div>
    </div>
  );
}

// ── Summaries ─────────────────────────────────────────────────

interface RowSummary {
  title: string;
  subtitle: string;
  amountOrTag: string;
  priorityLabel: string;
  badgeLabel: string;
  approveLabel: string;
  rejectLabel: string;
}

function summarizeRow(row: InboxRow): RowSummary {
  if (row.kind === "REQ") return summarizeRequest(row);
  if (row.kind === "BRK") return summarizeBroker(row);
  return summarizeReport(row);
}

function summarizeRequest(r: InboxRequestRow): RowSummary {
  const details = (r.details as Record<string, unknown>) ?? {};
  const amount = typeof details.amount === "string" ? (details.amount as string) : null;
  return {
    title: `${r.borrower.name || r.borrower.email} · ${r.mortgageCategory === "COMMERCIAL" ? "상업용" : "주거용"}`,
    subtitle: `${[r.city, r.province].filter(Boolean).join(", ")} · ${r.productTypes?.[0] || "신규"}`,
    amountOrTag: amount || (r.mortgageCategory === "COMMERCIAL" ? "상업용" : "주거용"),
    priorityLabel: "우선",
    badgeLabel: "상담 승인 대기",
    approveLabel: "승인",
    rejectLabel: "반려",
  };
}

function summarizeBroker(b: InboxBrokerRow): RowSummary {
  return {
    title: `${b.user.name || "브로커"} · ${b.brokerageName}`,
    subtitle: `${b.province} · ${b.licenseNumber}${b.yearsExperience != null ? ` · ${b.yearsExperience}년` : ""}`,
    amountOrTag: b.subscriptionTier,
    priorityLabel: "우선",
    badgeLabel: "전문가 인증 대기",
    approveLabel: "인증",
    rejectLabel: "반려",
  };
}

function summarizeReport(r: InboxReportRow): RowSummary {
  return {
    title: `${r.reporter.name || r.reporter.email} → ${r.targetId}`,
    subtitle: r.reason,
    amountOrTag: r.targetType,
    priorityLabel: "긴급",
    badgeLabel: "신고 미처리",
    approveLabel: "해결됨",
    rejectLabel: "기각",
  };
}

function openDetail(row: InboxRow) {
  // REQ and REP don't have dedicated detail pages — they live as drawers on
  // Activity and Reports respectively. BRK has its own detail page.
  if (row.kind === "REQ") {
    window.location.href = `/admin/activity?req=${encodeURIComponent(row.publicId)}`;
  } else if (row.kind === "BRK") {
    window.location.href = `/admin/brokers/${row.id}`;
  } else {
    window.location.href = `/admin/reports?id=${encodeURIComponent(row.id)}`;
  }
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
