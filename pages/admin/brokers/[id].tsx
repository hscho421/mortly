import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { adminSSR } from "@/lib/admin/ssrAuth";
import AdminShell from "@/components/admin/AdminShell";
import { useAdminData } from "@/lib/admin/AdminDataContext";
import { useToast } from "@/components/Toast";
import {
  ABadge,
  ABtn,
  ACard,
  ASectionHead,
  ADrawerError,
  AConfirmDialog,
} from "@/components/admin/primitives";
import type { Tone } from "@/components/admin/primitives/ABadge";
import { useDrawerResource, jsonOrThrow } from "@/lib/admin/useDrawerResource";
import { formatAdminDate } from "@/lib/admin/format";

/**
 * /admin/brokers/[id] — broker detail.
 *
 * Rewrite against AdminShell + adminSSR + primitives (Phase 1 execution).
 * Previous implementation used AdminLayout shim + legacy `rounded-full`
 * badges, `rose-600` buttons, `card-elevated`, `animate-fade-in-up stagger-*`,
 * and `window.confirm` — see audit §3 / §4.
 *
 * Related-conversation rows link into the Activity page's drawer
 * (`/admin/activity?id=<cuid>`) instead of the legacy
 * `/admin/conversations/[id]` page. That legacy page is scheduled for
 * deletion in Phase 2.
 */

interface BrokerDetail {
  id: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  phone: string | null;
  mortgageCategory: string;
  bio: string | null;
  yearsExperience: number | null;
  areasServed: string | null;
  specialties: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  subscriptionTier: string;
  responseCredits: number;
  createdAt: string;
  user: {
    id: string;
    publicId: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
    createdAt: string;
  };
  conversations: Array<{
    id: string;
    status: string;
    updatedAt: string;
    borrower: { id: string; name: string | null; email: string };
    request: { id: string; province: string; mortgageCategory?: string | null };
    _count: { messages: number };
  }>;
  _count: { conversations: number };
}

const VERIFICATION_TONE: Record<BrokerDetail["verificationStatus"], Tone> = {
  PENDING: "warn",
  VERIFIED: "success",
  REJECTED: "danger",
};
const ACCOUNT_TONE: Record<BrokerDetail["user"]["status"], Tone> = {
  ACTIVE: "success",
  SUSPENDED: "warn",
  BANNED: "danger",
};

type PendingAction =
  | { kind: "verify" }
  | { kind: "reject" }
  | { kind: "resetVerification" }
  | { kind: "suspend" }
  | { kind: "ban" }
  | { kind: "reactivate" };

export default function AdminBrokerDetailPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const { invalidate } = useAdminData();
  const brokerId = typeof router.query.id === "string" ? router.query.id : null;

  const [state, ctl] = useDrawerResource<BrokerDetail>(
    brokerId,
    (id) => fetch(`/api/admin/brokers/${id}`).then(jsonOrThrow<BrokerDetail>),
  );

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  const broker = state.state === "ready" ? state.data : null;

  const runAction = useCallback(
    async (action: PendingAction) => {
      if (!broker) return;
      setSaving(true);
      try {
        if (action.kind === "verify" || action.kind === "reject" || action.kind === "resetVerification") {
          const verificationStatus =
            action.kind === "verify"
              ? "VERIFIED"
              : action.kind === "reject"
              ? "REJECTED"
              : "PENDING";
          const r = await fetch(`/api/admin/brokers/${broker.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verificationStatus }),
          });
          if (!r.ok) {
            const data = await r.json().catch(() => ({} as { error?: string }));
            throw new Error(data.error || `HTTP ${r.status}`);
          }
        } else {
          const status =
            action.kind === "suspend" ? "SUSPENDED" : action.kind === "ban" ? "BANNED" : "ACTIVE";
          const r = await fetch(`/api/admin/users/${broker.user.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          if (!r.ok) {
            const data = await r.json().catch(() => ({} as { error?: string }));
            throw new Error(data.error || `HTTP ${r.status}`);
          }
        }
        toast(t("admin.brokerDetail.actionDone", "변경 완료"), "success");
        ctl.refresh();
        void invalidate();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed", "error");
      } finally {
        setSaving(false);
        setPending(null);
      }
    },
    [broker, ctl, invalidate, t, toast],
  );

  return (
    <AdminShell
      active="people"
      pageTitle={t("admin.brokerDetail.pageTitle", "전문가 · mortly admin")}
    >
      {state.state === "loading" && (
        <div className="p-10 text-center text-sm text-sage-500">
          {t("common.loading", "로딩 중…")}
        </div>
      )}
      {state.state === "error" && (
        <ADrawerError
          title={t("admin.brokerDetail.errorTitle", "전문가를 불러올 수 없습니다")}
          message={state.message}
          onRetry={state.retry}
        />
      )}
      {broker && (
        <BrokerDetailBody
          broker={broker}
          saving={saving}
          onRequestAction={setPending}
        />
      )}

      {pending && broker && (
        <AConfirmDialog
          open
          onClose={() => setPending(null)}
          tone={pending.kind === "reject" || pending.kind === "ban" ? "danger" : "default"}
          title={confirmTitle(pending, t)}
          description={confirmDescription(pending, broker, t)}
          confirmLabel={confirmLabel(pending, t)}
          onConfirm={() => runAction(pending)}
          loading={saving}
        />
      )}
    </AdminShell>
  );
}

type TFn = ReturnType<typeof useTranslation>["t"];

function confirmTitle(a: PendingAction, t: TFn): string {
  switch (a.kind) {
    case "verify":
      return t("admin.brokerDetail.confirm.verify.title", "전문가 인증");
    case "reject":
      return t("admin.brokerDetail.confirm.reject.title", "인증 반려");
    case "resetVerification":
      return t("admin.brokerDetail.confirm.reset.title", "인증 대기 상태로 재설정");
    case "suspend":
      return t("admin.brokerDetail.confirm.suspend.title", "계정 정지");
    case "ban":
      return t("admin.brokerDetail.confirm.ban.title", "계정 차단");
    case "reactivate":
      return t("admin.brokerDetail.confirm.reactivate.title", "계정 재활성화");
  }
}

function confirmDescription(a: PendingAction, broker: BrokerDetail, t: TFn): string {
  const name = broker.user.name || broker.user.email;
  switch (a.kind) {
    case "verify":
      return t(
        "admin.brokerDetail.confirm.verify.body",
        "{{name}}을(를) 인증 전문가로 등록합니다.",
        { name },
      );
    case "reject":
      return t(
        "admin.brokerDetail.confirm.reject.body",
        "{{name}}의 인증 요청을 반려합니다.",
        { name },
      );
    case "resetVerification":
      return t(
        "admin.brokerDetail.confirm.reset.body",
        "{{name}}의 인증을 대기 상태로 되돌립니다.",
        { name },
      );
    case "suspend":
      return t(
        "admin.brokerDetail.confirm.suspend.body",
        "{{name}}의 계정을 정지합니다.",
        { name },
      );
    case "ban":
      return t(
        "admin.brokerDetail.confirm.ban.body",
        "{{name}}의 계정을 차단합니다. 로그인이 불가능해집니다.",
        { name },
      );
    case "reactivate":
      return t(
        "admin.brokerDetail.confirm.reactivate.body",
        "{{name}}의 계정을 다시 활성화합니다.",
        { name },
      );
  }
}

function confirmLabel(a: PendingAction, t: TFn): string {
  switch (a.kind) {
    case "verify":
      return t("admin.brokerDetail.confirm.verify.confirm", "인증");
    case "reject":
      return t("admin.brokerDetail.confirm.reject.confirm", "반려");
    case "resetVerification":
      return t("admin.brokerDetail.confirm.reset.confirm", "대기로 재설정");
    case "suspend":
      return t("admin.brokerDetail.confirm.suspend.confirm", "정지");
    case "ban":
      return t("admin.brokerDetail.confirm.ban.confirm", "차단");
    case "reactivate":
      return t("admin.brokerDetail.confirm.reactivate.confirm", "재활성화");
  }
}

function BrokerDetailBody({
  broker,
  saving,
  onRequestAction,
}: {
  broker: BrokerDetail;
  saving: boolean;
  onRequestAction: (a: PendingAction) => void;
}) {
  const { t } = useTranslation("common");

  const profilePairs: Array<[string, string]> = [
    [t("admin.brokerDetail.field.brokerage", "브로커리지"), broker.brokerageName],
    [t("admin.brokerDetail.field.email", "이메일"), broker.user.email],
    [t("admin.brokerDetail.field.license", "라이선스"), broker.licenseNumber],
    [t("admin.brokerDetail.field.phone", "전화"), broker.phone || "—"],
    [t("admin.brokerDetail.field.province", "지역"), broker.province],
    [
      t("admin.brokerDetail.field.category", "분야"),
      broker.mortgageCategory === "COMMERCIAL"
        ? t("request.commercial", "상업용")
        : t("request.residential", "주거용"),
    ],
    [
      t("admin.brokerDetail.field.experience", "경력"),
      broker.yearsExperience != null
        ? t("admin.brokerDetail.years", "{{count}}년", { count: broker.yearsExperience })
        : "—",
    ],
    [t("admin.brokerDetail.field.areas", "활동지역"), broker.areasServed || "—"],
    [t("admin.brokerDetail.field.specialties", "전문분야"), broker.specialties || "—"],
    [
      t("admin.brokerDetail.field.joined", "가입일"),
      formatAdminDate(broker.user.createdAt, "short"),
    ],
  ];

  return (
    <div className="px-7 pt-6 pb-10 max-w-5xl">
      <Link
        href={{ pathname: "/admin/people", query: { role: "BROKER" } }}
        data-testid="broker-back-link"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] uppercase text-sage-500 hover:text-forest-800 transition-colors mb-4"
      >
        ← {t("admin.brokerDetail.back", "전문가 목록으로")}
      </Link>

      <ASectionHead
        label={t("admin.brokerDetail.eyebrow", "전문가 상세")}
        title={broker.user.name || broker.brokerageName}
        subtitle={
          <span className="font-mono text-[11px] text-sage-500">
            {broker.user.publicId} · {t("admin.brokerDetail.memberSince", "가입일")}{" "}
            {formatAdminDate(broker.user.createdAt, "short")}
          </span>
        }
        right={
          <div className="flex items-center gap-1.5">
            <ABadge tone={VERIFICATION_TONE[broker.verificationStatus]}>
              {broker.verificationStatus}
            </ABadge>
            <ABadge tone={ACCOUNT_TONE[broker.user.status]}>{broker.user.status}</ABadge>
            <ABadge tone="neutral">{broker.subscriptionTier}</ABadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mt-6">
        <ACard pad={0}>
          <div className="px-6 py-4 border-b border-cream-300">
            <div className="font-display text-lg font-semibold text-forest-800">
              {t("admin.brokerDetail.profileTitle", "프로필")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6">
            {profilePairs.map(([k, v]) => (
              <div key={k}>
                <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
                  {k}
                </div>
                <div className="text-[13px] font-medium mt-0.5 text-forest-800 truncate">{v}</div>
              </div>
            ))}
          </div>
          {broker.bio && (
            <div className="px-6 pb-6">
              <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em] mb-1.5">
                {t("admin.brokerDetail.field.bio", "자기소개")}
              </div>
              <div className="text-[13px] text-forest-700/80 italic leading-relaxed bg-cream-100 border border-cream-300 p-3 whitespace-pre-wrap">
                &ldquo;{broker.bio}&rdquo;
              </div>
            </div>
          )}
        </ACard>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <ACard pad={0}>
              <div className="px-5 py-4 text-center">
                <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
                  {t("admin.brokerDetail.creditsLabel", "크레딧")}
                </div>
                <div className="font-display text-3xl font-semibold text-amber-600 mt-1">
                  {broker.responseCredits}
                </div>
              </div>
            </ACard>
            <ACard pad={0}>
              <div className="px-5 py-4 text-center">
                <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
                  {t("admin.brokerDetail.convosLabel", "대화 수")}
                </div>
                <div className="font-display text-3xl font-semibold text-forest-800 mt-1">
                  {broker._count.conversations}
                </div>
              </div>
            </ACard>
          </div>

          <ACard pad={0}>
            <div className="px-6 py-4 border-b border-cream-300">
              <div className="font-display text-lg font-semibold text-forest-800">
                {t("admin.brokerDetail.verificationTitle", "인증 조치")}
              </div>
            </div>
            <div className="p-5 flex flex-wrap gap-2">
              {broker.verificationStatus !== "VERIFIED" && (
                <ABtn
                  size="sm"
                  variant="success"
                  disabled={saving}
                  onClick={() => onRequestAction({ kind: "verify" })}
                  data-testid="broker-verify"
                >
                  ✓ {t("admin.brokerDetail.verify", "인증")}
                </ABtn>
              )}
              {broker.verificationStatus !== "REJECTED" && (
                <ABtn
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => onRequestAction({ kind: "reject" })}
                  className="!text-error-700 !border-error-100"
                  data-testid="broker-reject"
                >
                  ✕ {t("admin.brokerDetail.reject", "반려")}
                </ABtn>
              )}
              {broker.verificationStatus !== "PENDING" && (
                <ABtn
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => onRequestAction({ kind: "resetVerification" })}
                  data-testid="broker-reset-verification"
                >
                  {t("admin.brokerDetail.resetPending", "대기로 재설정")}
                </ABtn>
              )}
            </div>
          </ACard>

          <ACard pad={0}>
            <div className="px-6 py-4 border-b border-cream-300">
              <div className="font-display text-lg font-semibold text-forest-800">
                {t("admin.brokerDetail.accountTitle", "계정 조치")}
              </div>
            </div>
            <div className="p-5 flex flex-wrap gap-2">
              {broker.user.status === "ACTIVE" && (
                <>
                  <ABtn
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => onRequestAction({ kind: "suspend" })}
                    className="!text-warning-700 !border-warning-100"
                    data-testid="broker-suspend"
                  >
                    {t("admin.brokerDetail.suspend", "정지")}
                  </ABtn>
                  <ABtn
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => onRequestAction({ kind: "ban" })}
                    className="!text-error-700 !border-error-100"
                    data-testid="broker-ban"
                  >
                    {t("admin.brokerDetail.ban", "차단")}
                  </ABtn>
                </>
              )}
              {broker.user.status !== "ACTIVE" && (
                <ABtn
                  size="sm"
                  variant="success"
                  disabled={saving}
                  onClick={() => onRequestAction({ kind: "reactivate" })}
                  data-testid="broker-reactivate"
                >
                  {t("admin.brokerDetail.reactivate", "재활성화")}
                </ABtn>
              )}
            </div>
          </ACard>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
            {t("admin.brokerDetail.recentConvos", "최근 대화")} · {broker._count.conversations}
          </div>
        </div>
        {broker.conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-sage-500 border border-dashed border-cream-300 bg-cream-50">
            {t("admin.brokerDetail.noConvos", "대화가 없습니다.")}
          </div>
        ) : (
          <div className="bg-cream-50 border border-cream-300">
            {broker.conversations.map((c, i) => (
              <Link
                key={c.id}
                href={`/admin/activity?id=${c.id}`}
                className={`grid grid-cols-[1fr_auto_120px] items-center gap-3 px-5 py-3 hover:bg-cream-100 transition-colors ${
                  i < broker.conversations.length - 1 ? "border-b border-cream-200" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-forest-800 truncate">
                    {c.borrower.name || c.borrower.email}
                  </div>
                  <div className="font-mono text-[11px] text-sage-500 mt-0.5 truncate">
                    {c._count.messages} {t("admin.brokerDetail.messages", "메시지")} ·{" "}
                    {formatAdminDate(c.updatedAt, "relative")}
                  </div>
                </div>
                <ABadge tone={c.status === "ACTIVE" ? "info" : "neutral"}>{c.status}</ABadge>
                <span className="font-mono text-[11px] text-sage-500 text-right truncate">
                  {c.request.province}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps = adminSSR();
