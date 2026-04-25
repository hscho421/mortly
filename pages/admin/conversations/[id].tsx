import { useCallback, useEffect, useState } from "react";
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
  ADrawerError,
  AConfirmDialog,
  ASectionHead,
  toneForConversationStatus,
  toneForUserStatus,
} from "@/components/admin/primitives";
import { useDrawerResource, jsonOrThrow } from "@/lib/admin/useDrawerResource";
import { formatAdminDate } from "@/lib/admin/format";

/**
 * /admin/conversations/[id] — full-page conversation viewer.
 *
 * Rewrite against AdminShell + adminSSR + primitives (Phase 2).
 * Unlike the Activity drawer, this page keeps the "load older messages"
 * pagination control for deep investigation. Activity drawer is the
 * zero-click entry point; this page is the "open full page" deep dive.
 */

interface MessageItem {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

interface ConversationDetail {
  id: string;
  publicId: string;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  borrower: {
    id: string;
    name: string | null;
    email: string;
    status: string;
  };
  broker: {
    id: string;
    brokerageName: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      status: string;
    };
  };
  request: {
    id: string;
    province: string;
    city: string | null;
    status: string;
    mortgageCategory?: string | null;
  };
  messages: MessageItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export default function AdminConversationDetailPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const { invalidate } = useAdminData();
  const conversationId = typeof router.query.id === "string" ? router.query.id : null;

  const [state, ctl] = useDrawerResource<ConversationDetail>(
    conversationId,
    (id) => fetch(`/api/admin/conversations/${id}`).then(jsonOrThrow<ConversationDetail>),
  );

  const [olderMessages, setOlderMessages] = useState<MessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const conversation = state.state === "ready" ? state.data : null;
  const conversationKey = conversation?.id ?? null;
  // Reset pagination state whenever the drawer resource loads a new conversation.
  useEffect(() => {
    if (!conversation) return;
    setOlderMessages([]);
    setNextCursor(conversation.nextCursor ?? null);
    setHasMore(Boolean(conversation.hasMore));
  }, [conversationKey, conversation]);

  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadOlderMessages = useCallback(async () => {
    if (!conversation || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const r = await fetch(
        `/api/admin/conversations/${conversation.id}?messagesBefore=${encodeURIComponent(nextCursor)}`,
      );
      if (!r.ok) {
        toast(
          t("admin.conversationDetail.loadOlderFailed", "이전 메시지를 불러오지 못했습니다"),
          "error",
        );
        return;
      }
      const data = (await r.json()) as ConversationDetail;
      setOlderMessages((prev) => [...(data.messages ?? []), ...prev]);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingOlder(false);
    }
  }, [conversation, nextCursor, loadingOlder, t, toast]);

  const closeConversation = useCallback(async () => {
    if (!conversation) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/conversations/${conversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      toast(t("admin.conversationDetail.closed", "대화가 종료되었습니다"), "success");
      ctl.refresh();
      void invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setSaving(false);
      setCloseConfirmOpen(false);
    }
  }, [conversation, ctl, invalidate, t, toast]);

  return (
    <AdminShell
      active="activity"
      pageTitle={t("admin.conversationDetail.pageTitle", "대화 · mortly admin")}
    >
      {state.state === "loading" && (
        <div className="p-10 text-center text-sm text-sage-500">
          {t("common.loading", "로딩 중…")}
        </div>
      )}
      {state.state === "error" && (
        <ADrawerError
          title={t("admin.conversationDetail.errorTitle", "대화를 불러올 수 없습니다")}
          message={state.message}
          onRetry={state.retry}
        />
      )}
      {conversation && (
        <ConversationBody
          conv={conversation}
          allMessages={[...olderMessages, ...(conversation.messages ?? [])]}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          saving={saving}
          onLoadOlder={loadOlderMessages}
          onRequestClose={() => setCloseConfirmOpen(true)}
        />
      )}

      {closeConfirmOpen && conversation && (
        <AConfirmDialog
          open
          onClose={() => setCloseConfirmOpen(false)}
          tone="danger"
          title={t("admin.conversationDetail.close.title", "대화 종료")}
          description={t(
            "admin.conversationDetail.close.body",
            "이 대화를 종료합니다. 양 당사자에게 관리자 종료 메시지가 전달됩니다.",
          )}
          confirmLabel={t("admin.conversationDetail.close.confirm", "종료")}
          onConfirm={closeConversation}
          loading={saving}
        />
      )}
    </AdminShell>
  );
}

function ConversationBody({
  conv,
  allMessages,
  hasMore,
  loadingOlder,
  saving,
  onLoadOlder,
  onRequestClose,
}: {
  conv: ConversationDetail;
  allMessages: MessageItem[];
  hasMore: boolean;
  loadingOlder: boolean;
  saving: boolean;
  onLoadOlder: () => void;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="px-7 pt-6 pb-10 max-w-4xl">
      <Link
        href={{ pathname: "/admin/activity", query: { type: "CONV" } }}
        data-testid="conversation-back-link"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] uppercase text-sage-500 hover:text-forest-800 transition-colors mb-4"
      >
        ← {t("admin.conversationDetail.back", "활동 피드로")}
      </Link>

      <ASectionHead
        label={t("admin.conversationDetail.eyebrow", "대화 상세")}
        title={
          <>
            {conv.borrower.name || conv.borrower.email} ↔{" "}
            {conv.broker.user.name || conv.broker.brokerageName}
          </>
        }
        subtitle={
          <span className="font-mono text-[11px] text-sage-500">
            {conv.publicId} · {formatAdminDate(conv.createdAt, "short")}
          </span>
        }
        right={
          <div className="flex items-center gap-1.5">
            <ABadge tone={toneForConversationStatus(conv.status)}>{conv.status}</ABadge>
            {conv.status === "ACTIVE" && (
              <ABtn
                size="sm"
                variant="ghost"
                className="!text-error-700 !border-error-100"
                onClick={onRequestClose}
                disabled={saving}
                data-testid="conversation-close-btn"
              >
                {t("admin.conversationDetail.closeAction", "대화 종료")}
              </ABtn>
            )}
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <PartyCard
          label={t("admin.conversationDetail.borrower", "신청인")}
          name={conv.borrower.name || "—"}
          email={conv.borrower.email}
          status={conv.borrower.status}
        />
        <PartyCard
          label={t("admin.conversationDetail.broker", "전문가")}
          name={conv.broker.user.name || "—"}
          email={conv.broker.user.email}
          status={conv.broker.user.status}
          extra={conv.broker.brokerageName}
        />
        <div className="bg-cream-50 border border-cream-300 p-4">
          <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
            {t("admin.conversationDetail.request", "관련 요청")}
          </div>
          <div className="text-[13px] font-medium text-forest-800 mt-1">
            {conv.request.mortgageCategory === "COMMERCIAL"
              ? t("request.commercial", "상업용")
              : t("request.residential", "주거용")}{" "}
            · {conv.request.province}
            {conv.request.city ? `, ${conv.request.city}` : ""}
          </div>
          <div className="font-mono text-[11px] text-sage-500 mt-1">
            {t("admin.conversationDetail.requestStatus", "요청 상태")}: {conv.request.status}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-cream-50 border border-cream-300">
        <div className="flex items-center justify-between px-5 py-3 border-b border-cream-300 bg-cream-100">
          <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">
            {t("admin.conversationDetail.thread", "메시지")} · {allMessages.length}
          </div>
          {hasMore && (
            <ABtn
              size="sm"
              variant="ghost"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              data-testid="conversation-load-older"
            >
              {loadingOlder
                ? t("common.loading", "로딩 중…")
                : t("admin.conversationDetail.loadOlder", "이전 메시지 불러오기")}
            </ABtn>
          )}
        </div>
        <div className="p-5 max-h-[600px] overflow-y-auto">
          {allMessages.length === 0 ? (
            <div className="py-10 text-center text-sm text-sage-500">
              {t("admin.conversationDetail.noMessages", "메시지가 없습니다.")}
            </div>
          ) : (
            allMessages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
        </div>
      </div>
    </div>
  );
}

function PartyCard({
  label,
  name,
  email,
  status,
  extra,
}: {
  label: string;
  name: string;
  email: string;
  status: string;
  extra?: string;
}) {
  return (
    <div className="bg-cream-50 border border-cream-300 p-4">
      <div className="font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em]">{label}</div>
      <div className="text-[13px] font-medium text-forest-800 mt-1 truncate">{name}</div>
      <div className="font-mono text-[11px] text-sage-500 mt-0.5 truncate">{email}</div>
      {extra && <div className="font-mono text-[11px] text-sage-500 mt-0.5 truncate">{extra}</div>}
      {status !== "ACTIVE" && (
        <div className="mt-2">
          <ABadge tone={toneForUserStatus(status)}>{status}</ABadge>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: MessageItem }) {
  const isBorrower = message.sender.role === "BORROWER";
  const isAdmin = message.sender.role === "ADMIN";

  if (isAdmin) {
    return (
      <div className="mb-3 flex justify-center">
        <div className="max-w-[80%] bg-amber-50 border border-amber-200 px-4 py-2.5 text-center">
          <div className="font-mono text-[10px] text-amber-700 uppercase tracking-[0.15em]">
            {message.sender.name || "ADMIN"}
          </div>
          <div className="text-[13px] text-amber-800 whitespace-pre-wrap mt-1">{message.body}</div>
          <div className="font-mono text-[10px] text-amber-600/60 mt-1.5">
            {formatAdminDate(message.createdAt, "short")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-3 flex ${isBorrower ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%]`}>
        <div
          className={`font-mono text-[10px] text-sage-500 mb-1 ${isBorrower ? "" : "text-right"}`}
        >
          {message.sender.name || message.sender.email} · {formatAdminDate(message.createdAt, "short")}
        </div>
        <div
          className={`p-3 border text-[13px] leading-relaxed whitespace-pre-wrap ${
            isBorrower
              ? "bg-cream-50 border-cream-300 text-forest-800"
              : "bg-forest-800 border-forest-800 text-cream-100"
          }`}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps = adminSSR();
