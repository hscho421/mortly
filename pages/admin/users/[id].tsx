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
  toneForRole,
  toneForUserStatus,
  toneForVerification,
  toneForTier,
  toneForRequestStatus,
  toneForConversationStatus,
} from "@/components/admin/primitives";
import { useDrawerResource, jsonOrThrow } from "@/lib/admin/useDrawerResource";
import { formatAdminDate } from "@/lib/admin/format";

/**
 * /admin/users/[id] — user detail.
 *
 * Rewrite against AdminShell + adminSSR + primitives (Phase 2).
 *
 * Key delta from the legacy version: no modal-in-modal. Request rows and
 * conversation rows link out to the Activity page with deep-link query
 * params (`?req=<publicId>` and `?id=<cuid>`), reusing the drawer that
 * already exists there. The previous page shipped two bespoke modals
 * totalling ~500 LOC; those are gone.
 */

interface BorrowerRequestItem {
  id: string;
  publicId: string;
  province: string;
  city: string | null;
  status: string;
  mortgageCategory: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationItem {
  id: string;
  publicId: string;
  status: string;
  updatedAt: string;
  _count: { messages: number };
  broker: { id: string; user: { name: string | null; email: string } };
  borrower: { id: string; name: string | null; email: string };
  request: { id: string; province: string; mortgageCategory: string | null };
}

interface UserDetail {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
  broker: {
    id: string;
    brokerageName: string;
    province: string;
    licenseNumber: string;
    phone: string | null;
    mortgageCategory: string;
    bio: string | null;
    yearsExperience: number | null;
    verificationStatus: string;
    subscriptionTier: string;
    responseCredits: number;
  } | null;
  borrowerRequests: BorrowerRequestItem[];
  conversations: ConversationItem[];
  _count: {
    borrowerRequests: number;
    conversations: number;
    reports: number;
  };
}

type PendingAction =
  | { kind: "suspend" }
  | { kind: "ban" }
  | { kind: "reactivate" };

export default function AdminUserDetailPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const { invalidate } = useAdminData();
  const userId = typeof router.query.id === "string" ? router.query.id : null;

  const [state, ctl] = useDrawerResource<UserDetail>(
    userId,
    (id) => fetch(`/api/admin/users/${id}`).then(jsonOrThrow<UserDetail>),
  );

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  const user = state.state === "ready" ? state.data : null;

  const runAction = useCallback(
    async (action: PendingAction) => {
      if (!user) return;
      setSaving(true);
      try {
        const status =
          action.kind === "suspend" ? "SUSPENDED" : action.kind === "ban" ? "BANNED" : "ACTIVE";
        const r = await fetch(`/api/admin/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({} as { error?: string }));
          throw new Error(data.error || `HTTP ${r.status}`);
        }
        toast(t("admin.userDetail.actionDone", "변경 완료"), "success");
        ctl.refresh();
        void invalidate();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed", "error");
      } finally {
        setSaving(false);
        setPending(null);
      }
    },
    [user, ctl, invalidate, t, toast],
  );

  return (
    <AdminShell active="people" pageTitle={t("admin.userDetail.pageTitle", "사용자 · mortly admin")}>
      {state.state === "loading" && (
        <div className="p-10 text-center text-sm text-sage-500">
          {t("common.loading", "로딩 중…")}
        </div>
      )}
      {state.state === "error" && (
        <ADrawerError
          title={t("admin.userDetail.errorTitle", "사용자를 불러올 수 없습니다")}
          message={state.message}
          onRetry={state.retry}
        />
      )}
      {user && <UserDetailBody user={user} saving={saving} onRequestAction={setPending} />}

      {pending && user && (
        <AConfirmDialog
          open
          onClose={() => setPending(null)}
          tone={pending.kind === "ban" ? "danger" : pending.kind === "suspend" ? "danger" : "default"}
          title={confirmTitle(pending, t)}
          description={confirmDescription(pending, user, t)}
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
    case "suspend":
      return t("admin.userDetail.confirm.suspend.title", "계정 정지");
    case "ban":
      return t("admin.userDetail.confirm.ban.title", "계정 차단");
    case "reactivate":
      return t("admin.userDetail.confirm.reactivate.title", "계정 재활성화");
  }
}

function confirmDescription(a: PendingAction, user: UserDetail, t: TFn): string {
  const name = user.name || user.email;
  switch (a.kind) {
    case "suspend":
      return t(
        "admin.userDetail.confirm.suspend.body",
        "{{name}}의 계정을 정지합니다.",
        { name },
      );
    case "ban":
      return t(
        "admin.userDetail.confirm.ban.body",
        "{{name}}의 계정을 차단합니다. 로그인이 불가능해집니다.",
        { name },
      );
    case "reactivate":
      return t(
        "admin.userDetail.confirm.reactivate.body",
        "{{name}}의 계정을 다시 활성화합니다.",
        { name },
      );
  }
}

function confirmLabel(a: PendingAction, t: TFn): string {
  switch (a.kind) {
    case "suspend":
      return t("admin.userDetail.confirm.suspend.confirm", "정지");
    case "ban":
      return t("admin.userDetail.confirm.ban.confirm", "차단");
    case "reactivate":
      return t("admin.userDetail.confirm.reactivate.confirm", "재활성화");
  }
}

function UserDetailBody({
  user,
  saving,
  onRequestAction,
}: {
  user: UserDetail;
  saving: boolean;
  onRequestAction: (a: PendingAction) => void;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="px-7 pt-6 pb-10 max-w-5xl">
      <Link
        href="/admin/people"
        data-testid="user-back-link"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] uppercase text-sage-500 hover:text-forest-800 transition-colors mb-4"
      >
        ← {t("admin.userDetail.back", "사용자 목록으로")}
      </Link>

      <ASectionHead
        label={t("admin.userDetail.eyebrow", "사용자 상세")}
        title={user.name || t("admin.userDetail.unnamed", "이름 없음")}
        subtitle={
          <span className="font-mono text-[11px] text-sage-500">
            {user.publicId} · {user.email}
          </span>
        }
        right={
          <div className="flex items-center gap-1.5">
            <ABadge tone={toneForRole(user.role)}>{user.role}</ABadge>
            <ABadge tone={toneForUserStatus(user.status)}>{user.status}</ABadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mt-6">
        <UserInformation user={user} />

        <div className="flex flex-col gap-5">
          <StatsRow user={user} />
          <AccountActions
            user={user}
            saving={saving}
            onRequestAction={onRequestAction}
          />
        </div>
      </div>

      {user.broker && <BrokerDetails broker={user.broker} />}

      <RecentRequestsTable requests={user.borrowerRequests} total={user._count.borrowerRequests} />

      <RecentConversationsTable
        viewerRole={user.role}
        conversations={user.conversations}
        total={user._count.conversations}
      />
    </div>
  );
}

function UserInformation({ user }: { user: UserDetail }) {
  const { t } = useTranslation("common");
  const pairs: Array<[string, string]> = [
    [t("admin.userDetail.field.publicId", "ID"), user.publicId],
    [t("admin.userDetail.field.email", "이메일"), user.email],
    [t("admin.userDetail.field.role", "역할"), user.role],
    [t("admin.userDetail.field.status", "상태"), user.status],
    [
      t("admin.userDetail.field.emailVerified", "이메일 인증"),
      user.emailVerified ? t("admin.userDetail.verified", "인증됨") : t("admin.userDetail.unverified", "미인증"),
    ],
    [t("admin.userDetail.field.joined", "가입일"), formatAdminDate(user.createdAt, "short")],
    [t("admin.userDetail.field.updated", "수정일"), formatAdminDate(user.updatedAt, "short")],
  ];
  return (
    <ACard pad={0}>
      <div className="px-6 py-4 border-b border-cream-300">
        <div className="font-display text-lg font-semibold text-forest-800">
          {t("admin.userDetail.infoTitle", "정보")}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-6">
        {pairs.map(([k, v]) => (
          <div key={k}>
            <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">{k}</div>
            <div className="text-[13px] font-medium mt-0.5 text-forest-800 truncate">{v}</div>
          </div>
        ))}
      </div>
    </ACard>
  );
}

function StatsRow({ user }: { user: UserDetail }) {
  const { t } = useTranslation("common");
  const stats: Array<{ label: string; value: number | string; color?: string }> = [];
  if (user.role === "BROKER" && user.broker) {
    stats.push({
      label: t("admin.userDetail.stats.credits", "크레딧"),
      value: user.broker.responseCredits,
      color: "text-amber-600",
    });
  }
  stats.push(
    {
      label: t("admin.userDetail.stats.requests", "요청"),
      value: user._count.borrowerRequests,
    },
    {
      label: t("admin.userDetail.stats.conversations", "대화"),
      value: user._count.conversations,
    },
    {
      label: t("admin.userDetail.stats.reports", "신고"),
      value: user._count.reports,
    },
  );
  const gridCols =
    stats.length === 1
      ? "grid-cols-1"
      : stats.length === 2
      ? "grid-cols-2"
      : stats.length === 3
      ? "grid-cols-3"
      : "grid-cols-4";
  return (
    <div className={`grid ${gridCols} gap-3`}>
      {stats.map((s) => (
        <ACard key={s.label} pad={0}>
          <div className="px-4 py-4 text-center">
            <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
              {s.label}
            </div>
            <div
              className={`font-display text-2xl font-semibold mt-1 ${s.color ?? "text-forest-800"}`}
            >
              {s.value}
            </div>
          </div>
        </ACard>
      ))}
    </div>
  );
}

function AccountActions({
  user,
  saving,
  onRequestAction,
}: {
  user: UserDetail;
  saving: boolean;
  onRequestAction: (a: PendingAction) => void;
}) {
  const { t } = useTranslation("common");
  if (user.role === "ADMIN") {
    return (
      <ACard pad={0}>
        <div className="px-6 py-4 border-b border-cream-300">
          <div className="font-display text-lg font-semibold text-forest-800">
            {t("admin.userDetail.actionsTitle", "계정 조치")}
          </div>
        </div>
        <div className="p-5 text-[12px] text-sage-500">
          {t("admin.userDetail.adminNote", "관리자 계정은 상태를 변경할 수 없습니다.")}
        </div>
      </ACard>
    );
  }
  return (
    <ACard pad={0}>
      <div className="px-6 py-4 border-b border-cream-300">
        <div className="font-display text-lg font-semibold text-forest-800">
          {t("admin.userDetail.actionsTitle", "계정 조치")}
        </div>
      </div>
      <div className="p-5 flex flex-wrap gap-2">
        {user.status === "ACTIVE" && (
          <>
            <ABtn
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => onRequestAction({ kind: "suspend" })}
              className="!text-warning-700 !border-warning-100"
              data-testid="user-suspend"
            >
              {t("admin.userDetail.suspend", "정지")}
            </ABtn>
            <ABtn
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => onRequestAction({ kind: "ban" })}
              className="!text-error-700 !border-error-100"
              data-testid="user-ban"
            >
              {t("admin.userDetail.ban", "차단")}
            </ABtn>
          </>
        )}
        {user.status !== "ACTIVE" && (
          <ABtn
            size="sm"
            variant="success"
            disabled={saving}
            onClick={() => onRequestAction({ kind: "reactivate" })}
            data-testid="user-reactivate"
          >
            {t("admin.userDetail.reactivate", "재활성화")}
          </ABtn>
        )}
      </div>
    </ACard>
  );
}

function BrokerDetails({ broker }: { broker: NonNullable<UserDetail["broker"]> }) {
  const { t } = useTranslation("common");
  const pairs: Array<[string, string]> = [
    [t("admin.userDetail.broker.brokerage", "브로커리지"), broker.brokerageName],
    [t("admin.userDetail.broker.license", "라이선스"), broker.licenseNumber],
    [t("admin.userDetail.broker.province", "지역"), broker.province],
    [t("admin.userDetail.broker.phone", "전화"), broker.phone || "—"],
    [
      t("admin.userDetail.broker.category", "분야"),
      broker.mortgageCategory === "COMMERCIAL" ? t("request.commercial", "상업용") : t("request.residential", "주거용"),
    ],
    [
      t("admin.userDetail.broker.experience", "경력"),
      broker.yearsExperience != null
        ? t("admin.userDetail.broker.years", "{{count}}년", { count: broker.yearsExperience })
        : "—",
    ],
  ];
  return (
    <ACard pad={0} className="mt-6">
      <div className="px-6 py-4 border-b border-cream-300 flex items-center justify-between">
        <div className="font-display text-lg font-semibold text-forest-800">
          {t("admin.userDetail.broker.title", "전문가 프로필")}
        </div>
        <div className="flex items-center gap-1.5">
          <ABadge tone={toneForVerification(broker.verificationStatus)}>
            {broker.verificationStatus}
          </ABadge>
          <ABadge tone={toneForTier(broker.subscriptionTier)}>{broker.subscriptionTier}</ABadge>
          <Link
            href={`/admin/brokers/${broker.id}`}
            className="font-mono text-[11px] text-sage-500 hover:text-forest-800 underline decoration-dotted underline-offset-2"
          >
            {t("admin.userDetail.broker.openFull", "전체 프로필")}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-6">
        {pairs.map(([k, v]) => (
          <div key={k}>
            <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">{k}</div>
            <div className="text-[13px] font-medium mt-0.5 text-forest-800 truncate">{v}</div>
          </div>
        ))}
      </div>
      {broker.bio && (
        <div className="px-6 pb-6">
          <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em] mb-1.5">
            {t("admin.userDetail.broker.bio", "자기소개")}
          </div>
          <div className="text-[13px] text-forest-700/80 italic leading-relaxed bg-cream-100 border border-cream-300 p-3 whitespace-pre-wrap">
            &ldquo;{broker.bio}&rdquo;
          </div>
        </div>
      )}
    </ACard>
  );
}

function RecentRequestsTable({
  requests,
  total,
}: {
  requests: BorrowerRequestItem[];
  total: number;
}) {
  const { t } = useTranslation("common");
  if (requests.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
          {t("admin.userDetail.requests.title", "최근 요청")} · {total}
        </div>
      </div>
      <div className="bg-cream-50 border border-cream-300">
        {requests.map((r, i) => (
          <Link
            key={r.id}
            href={`/admin/activity?req=${r.publicId}`}
            data-testid="user-request-row"
            className={`grid grid-cols-[110px_1fr_auto_140px] items-center gap-3 px-5 py-3 hover:bg-cream-100 transition-colors ${
              i < requests.length - 1 ? "border-b border-cream-200" : ""
            }`}
          >
            <span className="font-mono text-[11px] text-sage-500">{r.publicId}</span>
            <span className="text-[13px] font-medium text-forest-800 truncate">
              {r.province}
              {r.city ? `, ${r.city}` : ""} ·{" "}
              {r.mortgageCategory === "COMMERCIAL"
                ? t("request.commercial", "상업용")
                : t("request.residential", "주거용")}
            </span>
            <ABadge tone={toneForRequestStatus(r.status)}>{r.status}</ABadge>
            <span className="font-mono text-[11px] text-sage-500 text-right truncate">
              {formatAdminDate(r.createdAt, "short")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentConversationsTable({
  conversations,
  total,
  viewerRole,
}: {
  conversations: ConversationItem[];
  total: number;
  viewerRole: UserDetail["role"];
}) {
  const { t } = useTranslation("common");
  if (conversations.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
          {t("admin.userDetail.conversations.title", "최근 대화")} · {total}
        </div>
      </div>
      <div className="bg-cream-50 border border-cream-300">
        {conversations.map((c, i) => {
          const other =
            viewerRole === "BROKER"
              ? c.borrower.name || c.borrower.email
              : c.broker.user.name || c.broker.user.email;
          return (
            <Link
              key={c.id}
              href={`/admin/activity?id=${c.id}`}
              data-testid="user-conversation-row"
              className={`grid grid-cols-[110px_1fr_auto_140px] items-center gap-3 px-5 py-3 hover:bg-cream-100 transition-colors ${
                i < conversations.length - 1 ? "border-b border-cream-200" : ""
              }`}
            >
              <span className="font-mono text-[11px] text-sage-500">{c.publicId}</span>
              <span className="text-[13px] font-medium text-forest-800 truncate">
                {other} · {c._count.messages} {t("admin.userDetail.conversations.messages", "메시지")}
              </span>
              <ABadge tone={toneForConversationStatus(c.status)}>{c.status}</ABadge>
              <span className="font-mono text-[11px] text-sage-500 text-right truncate">
                {formatAdminDate(c.updatedAt, "short")}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export const getServerSideProps = adminSSR();
