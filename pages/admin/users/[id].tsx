import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { PRODUCT_LABEL_KEYS, INCOME_TYPE_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";

interface BorrowerRequestItem {
  id: string;
  publicId: string;
  province: string;
  city: string | null;
  status: string;
  mortgageCategory: string | null;
  productTypes?: string[] | null;
  details: Record<string, unknown> | null;
  desiredTimeline: string | null;
  notes: string | null;
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
  status: string;
  createdAt: string;
  updatedAt: string;
  borrower: { id: string; name: string | null; email: string; status: string };
  broker: {
    id: string;
    brokerageName: string;
    user: { id: string; name: string | null; email: string; status: string };
  };
  request: { id: string; province: string; city: string | null; status: string; mortgageCategory?: string | null };
  messages: MessageItem[];
}

interface UserDetail {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
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

const ROLE_BADGE: Record<string, string> = {
  BORROWER: "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20",
  BROKER: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  ADMIN: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-forest-100 text-forest-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  BANNED: "bg-rose-100 text-rose-700",
};

const REQUEST_STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  OPEN: "bg-forest-100 text-forest-700",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  CLOSED: "bg-sage-200 text-sage-700",
  EXPIRED: "bg-sage-200 text-sage-600",
  REJECTED: "bg-rose-100 text-rose-700",
};

const VERIFICATION_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-forest-100 text-forest-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const TIER_BADGE: Record<string, string> = {
  FREE: "bg-cream-200 text-forest-600",
  BASIC: "bg-sage-100 text-sage-700",
  PRO: "bg-forest-100 text-forest-700",
  PREMIUM: "bg-amber-100 text-amber-800",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  BORROWER: { bg: "bg-sage-100", text: "text-sage-700" },
  BROKER: { bg: "bg-forest-100", text: "text-forest-700" },
  ADMIN: { bg: "bg-amber-100", text: "text-amber-800" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return "$" + val.toLocaleString();
}

export default function AdminUserDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("common");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Request detail modal
  const [detailRequest, setDetailRequest] = useState<BorrowerRequestItem | null>(null);

  // Conversation chat modal
  const [chatConversation, setChatConversation] = useState<ConversationDetail | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "ADMIN") return;

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        if (res.ok) {
          setUser(await res.json());
        } else {
          setError(t("admin.userDetail.notFound"));
        }
      } catch {
        setError(t("admin.userDetail.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [session, status, id, t]);

  const handleStatusChange = async (newStatus: string) => {
    if (!user) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setUser((prev) => (prev ? { ...prev, status: newStatus } : prev));
        setActionMessage({ text: t("admin.statusUpdated"), ok: true });
      } else {
        const data = await res.json();
        setActionMessage({ text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ text: t("admin.userDetail.updateError"), ok: false });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const copyPublicId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.publicId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const openChat = async (convoId: string) => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${convoId}`);
      if (res.ok) {
        setChatConversation(await res.json());
      }
    } catch {
      // error
    } finally {
      setChatLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.userDetail.loading")}</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !user) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <p className="text-body-sm text-rose-600">{error || t("admin.userDetail.notFound")}</p>
          <Link href="/admin/users" className="btn-secondary mt-4 inline-block">
            {t("admin.userDetail.backToUsers")}
          </Link>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminUserDetail")}</title></Head>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/users"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.userDetail.backToUsers")}
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="heading-lg">{user.name || t("admin.userDetail.unnamed")}</h1>
              <p className="font-body text-sm text-forest-700/60 mt-1">{user.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs font-semibold uppercase ${STATUS_BADGE[user.status]}`}>
                {user.status}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs font-semibold uppercase ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* User Information */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-1">
          <h2 className="heading-sm mb-4">{t("admin.userDetail.information")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="label-text">{t("admin.userDetail.publicId")}</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-forest-800">{user.publicId}</p>
                <button
                  onClick={copyPublicId}
                  className="inline-flex items-center rounded-md bg-cream-100 px-2 py-1 transition-colors hover:bg-cream-200"
                  title={t("admin.userDetail.copyId")}
                >
                  {copiedId ? (
                    <svg className="h-3.5 w-3.5 text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-sage-400 hover:text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="label-text">{t("admin.email")}</p>
              <div className="flex items-center gap-2">
                <p className="font-body text-sm text-forest-800">{user.email}</p>
                {user.emailVerified ? (
                  <span className="inline-flex items-center rounded-full bg-forest-100 px-2 py-0.5 font-body text-[10px] font-semibold text-forest-700">
                    {t("admin.userDetail.verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-body text-[10px] font-semibold text-amber-800">
                    {t("admin.userDetail.unverified")}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="label-text">{t("admin.role")}</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </div>
            <div>
              <p className="label-text">{t("admin.accountStatus")}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[user.status]}`}>
                  {user.status}
                </span>
                {user.role !== "ADMIN" && (
                  <div className="flex items-center gap-1.5">
                    {user.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => handleStatusChange("SUSPENDED")}
                          disabled={actionLoading}
                          className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50"
                        >
                          {actionLoading ? "..." : t("admin.suspendUser")}
                        </button>
                        <button
                          onClick={() => handleStatusChange("BANNED")}
                          disabled={actionLoading}
                          className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                        >
                          {actionLoading ? "..." : t("admin.banUser")}
                        </button>
                      </>
                    )}
                    {user.status !== "ACTIVE" && (
                      <button
                        onClick={() => handleStatusChange("ACTIVE")}
                        disabled={actionLoading}
                        className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                      >
                        {actionLoading ? "..." : t("admin.reactivate")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {actionMessage && (
                <p className={`mt-2 font-body text-xs ${actionMessage.ok ? "text-forest-600" : "text-rose-600"}`}>
                  {actionMessage.text}
                </p>
              )}
            </div>
            <div>
              <p className="label-text">{t("admin.joined")}</p>
              <p className="font-body text-sm text-forest-800">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.userDetail.lastUpdated")}</p>
              <p className="font-body text-sm text-forest-800">{formatDateTime(user.updatedAt)}</p>
            </div>
          </div>
        </div>

        {/* Broker Details (if BROKER role) */}
        {user.role === "BROKER" && user.broker && (
          <div className="card-elevated mb-6 animate-fade-in-up stagger-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-sm">{t("admin.userDetail.brokerDetails")}</h2>
              <Link
                href={`/admin/brokers/${user.broker.id}`}
                className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
              >
                {t("admin.userDetail.viewBrokerProfile")}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="label-text">{t("admin.brokerage")}</p>
                <p className="font-body text-sm font-semibold text-forest-800">{user.broker.brokerageName}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.province")}</p>
                <p className="font-body text-sm text-forest-800">{user.broker.province}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.licenseNumber")}</p>
                <p className="font-mono text-sm text-forest-800">{user.broker.licenseNumber}</p>
              </div>
              <div>
                <p className="label-text">{t("broker.phone")}</p>
                <p className="font-body text-sm text-forest-800">{user.broker.phone || "—"}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.category")}</p>
                <p className="font-body text-sm text-forest-800">{user.broker.mortgageCategory}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.experience")}</p>
                <p className="font-body text-sm text-forest-800">
                  {user.broker.yearsExperience != null
                    ? t("admin.userDetail.yearsCount", { count: user.broker.yearsExperience })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="label-text">{t("admin.userDetail.verificationStatus")}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${VERIFICATION_BADGE[user.broker.verificationStatus]}`}>
                  {user.broker.verificationStatus}
                </span>
              </div>
              <div>
                <p className="label-text">{t("admin.userDetail.subscriptionTier")}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${TIER_BADGE[user.broker.subscriptionTier]}`}>
                  {user.broker.subscriptionTier}
                </span>
              </div>
              <div>
                <p className="label-text">{t("admin.userDetail.responseCredits")}</p>
                <p className="font-display text-xl text-amber-700">{user.broker.responseCredits}</p>
              </div>
            </div>
            {user.broker.bio && (
              <div className="mt-4 border-t border-cream-200 pt-4">
                <p className="label-text">{t("admin.bio")}</p>
                <p className="font-body text-sm text-forest-700/80 bg-cream-50 rounded-lg p-3">{user.broker.bio}</p>
              </div>
            )}
          </div>
        )}

        {/* Borrower Requests */}
        {user.borrowerRequests.length > 0 && (
          <div className="card-elevated mb-6 animate-fade-in-up stagger-3">
            <h2 className="heading-sm mb-4">
              {t("admin.userDetail.borrowerRequests")} ({user._count.borrowerRequests})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cream-200">
                <thead>
                  <tr className="bg-cream-50">
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.requestId")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.province")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.category")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.accountStatus")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.userDetail.date")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {user.borrowerRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailRequest(req)}
                          className="font-mono text-xs text-forest-600 hover:text-forest-800 hover:underline transition-colors"
                        >
                          {req.publicId}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-forest-800">
                        {req.province}{req.city ? `, ${req.city}` : ""}
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-forest-800">
                        {req.mortgageCategory === "COMMERCIAL"
                          ? t("request.commercial")
                          : t("request.residential")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase ${REQUEST_STATUS_BADGE[req.status] || "bg-sage-100 text-sage-600"}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-forest-700/70">{formatDate(req.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conversations */}
        {user.conversations.length > 0 && (
          <div className="card-elevated mb-6 animate-fade-in-up stagger-4">
            <h2 className="heading-sm mb-4">
              {t("admin.recentConversations")} ({user._count.conversations})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cream-200">
                <thead>
                  <tr className="bg-cream-50">
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.userDetail.conversationId")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.accountStatus")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.userDetail.with")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.userDetail.messages")}
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-forest-700/70">
                      {t("admin.userDetail.lastUpdated")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {user.conversations.map((convo) => {
                    const otherParty = user.role === "BROKER"
                      ? (convo.borrower.name || convo.borrower.email)
                      : (convo.broker.user.name || convo.broker.user.email);

                    return (
                      <tr key={convo.id} className="hover:bg-cream-50 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openChat(convo.id)}
                            className="font-mono text-xs text-forest-600 hover:text-forest-800 hover:underline transition-colors"
                          >
                            {convo.publicId}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase ${convo.status === "ACTIVE" ? "bg-forest-100 text-forest-700" : "bg-sage-100 text-sage-600"}`}>
                            {convo.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-body text-sm text-forest-800">{otherParty}</td>
                        <td className="px-4 py-3 font-body text-sm text-forest-800">{convo._count.messages}</td>
                        <td className="px-4 py-3 font-body text-sm text-forest-700/70">{formatDateTime(convo.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Summary */}
        <div className="card-elevated animate-fade-in-up stagger-5">
          <h2 className="heading-sm mb-4">{t("admin.userDetail.activitySummary")}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center rounded-lg bg-cream-50 p-4">
              <p className="font-display text-2xl text-forest-800">{user._count.borrowerRequests}</p>
              <p className="text-body-sm">{t("admin.requests")}</p>
            </div>
            <div className="text-center rounded-lg bg-cream-50 p-4">
              <p className="font-display text-2xl text-forest-800">{user._count.conversations}</p>
              <p className="text-body-sm">{t("admin.conversations")}</p>
            </div>
            <div className="text-center rounded-lg bg-cream-50 p-4">
              <p className="font-display text-2xl text-forest-800">{user._count.reports}</p>
              <p className="text-body-sm">{t("admin.reports")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Request Detail Modal */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setDetailRequest(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setDetailRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="heading-md">{t("admin.requestDetails")}</h3>
                <span className="font-mono text-xs text-forest-700/50">{detailRequest.publicId}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${REQUEST_STATUS_BADGE[detailRequest.status] || "bg-sage-100 text-sage-600"}`}>
                  {detailRequest.status}
                </span>
              </div>
              <p className="font-body text-xs text-forest-700/60 mt-1">
                {t("admin.created")}: {formatDate(detailRequest.createdAt)} · {t("admin.userDetail.updated")}: {formatDate(detailRequest.updatedAt)}
              </p>
            </div>

            {/* Request Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="label-text">{t("request.mortgageCategory")}</p>
                  <p className="font-body text-sm text-forest-800">
                    {detailRequest.mortgageCategory === "COMMERCIAL"
                      ? t("request.commercial")
                      : t("request.residential")}
                  </p>
                </div>
                <div>
                  <p className="label-text">{t("admin.location")}</p>
                  <p className="font-body text-sm text-forest-800">
                    {detailRequest.province}{detailRequest.city ? `, ${detailRequest.city}` : ""}
                  </p>
                </div>
              </div>

              {/* Product Types */}
              {detailRequest.productTypes && detailRequest.productTypes.length > 0 && (
                <div>
                  <p className="label-text">{t("request.selectProducts")}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {detailRequest.productTypes.map((pt: string) => (
                      <span key={pt} className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700">
                        {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Residential sub-details */}
              {detailRequest.mortgageCategory === "RESIDENTIAL" && detailRequest.details && (() => {
                const details = detailRequest.details as Record<string, any>;
                return (
                  <div className="rounded-lg bg-cream-50 p-4 space-y-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-forest-600">
                      {t("request.residential")} {t("admin.details")}
                    </p>
                    {details.purposeOfUse && (
                      <div>
                        <p className="label-text">{t("request.purposeOfUse")}</p>
                        <p className="font-body text-sm text-forest-800">
                          {details.purposeOfUse === "OWNER_OCCUPIED" ? t("request.ownerOccupied") : t("request.rental")}
                        </p>
                      </div>
                    )}
                    {details.incomeTypes && Array.isArray(details.incomeTypes) && (details.incomeTypes as string[]).length > 0 && (
                      <div>
                        <p className="label-text">{t("request.incomeType")}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(details.incomeTypes as string[]).map((it: string) => (
                            <span key={it} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 font-body text-xs font-medium text-amber-800">
                              {t(INCOME_TYPE_LABEL_KEYS[it] ?? it)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {details.incomeTypeOther && (
                      <div>
                        <p className="label-text">{t("request.incomeTypeOther")}</p>
                        <p className="font-body text-sm text-forest-800">{details.incomeTypeOther as string}</p>
                      </div>
                    )}
                    {details.annualIncome && typeof details.annualIncome === "object" && (
                      <div className="col-span-3">
                        <p className="label-text mb-2">{t("request.annualIncome")}</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-cream-200">
                              <th className="font-body font-medium text-sage-500 text-left py-1.5 pr-4">{t("request.selectYear")}</th>
                              <th className="font-body font-medium text-sage-500 text-right py-1.5">{t("request.annualIncome")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(details.annualIncome as Record<string, string>).sort(([a], [b]) => b.localeCompare(a)).map(([year, amount]) => (
                              <tr key={year} className="border-b border-cream-100">
                                <td className="font-body text-forest-800 py-1.5 pr-4">{year}</td>
                                <td className="font-body font-medium text-forest-800 text-right py-1.5">${amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Commercial sub-details */}
              {detailRequest.mortgageCategory === "COMMERCIAL" && detailRequest.details && (() => {
                const details = detailRequest.details as Record<string, any>;
                return (
                  <div className="rounded-lg bg-cream-50 p-4 space-y-3">
                    <p className="font-body text-xs font-semibold uppercase tracking-wide text-forest-600">
                      {t("request.commercial")} {t("admin.details")}
                    </p>
                    {details.businessType && (
                      <div>
                        <p className="label-text">{t("request.businessType")}</p>
                        <p className="font-body text-sm text-forest-800">{details.businessType as string}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                      {(details.corporateAnnualIncome != null || details.corporateAnnualExpenses != null) && (
                        <div className="col-span-3">
                          <p className="label-text mb-2">{t("request.corporateFinancials")}</p>
                          {typeof details.corporateAnnualIncome === "object" ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-cream-200">
                                  <th className="font-body font-medium text-sage-500 text-left py-1.5 pr-4">{t("request.selectYear")}</th>
                                  <th className="font-body font-medium text-sage-500 text-right py-1.5 px-4">{t("request.corpIncome")}</th>
                                  <th className="font-body font-medium text-sage-500 text-right py-1.5 pl-4">{t("request.corpExpenses")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(details.corporateAnnualIncome).sort().reverse().map((year) => (
                                  <tr key={year} className="border-b border-cream-100">
                                    <td className="font-body text-forest-800 py-1.5 pr-4">{year}</td>
                                    <td className="font-body text-forest-800 text-right py-1.5 px-4">${(details.corporateAnnualIncome as Record<string, string>)[year] || "—"}</td>
                                    <td className="font-body text-forest-800 text-right py-1.5 pl-4">${((details.corporateAnnualExpenses as Record<string, string>) || {})[year] || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="font-body text-xs text-sage-500">{t("request.corpIncome")}</p>
                                <p className="font-body text-sm text-forest-800">${String(details.corporateAnnualIncome)}</p>
                              </div>
                              <div>
                                <p className="font-body text-xs text-sage-500">{t("request.corpExpenses")}</p>
                                <p className="font-body text-sm text-forest-800">${String(details.corporateAnnualExpenses)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {details.ownerNetIncome != null && (
                        <div>
                          <p className="label-text">{t("request.ownerNetIncome")}</p>
                          <p className="font-body text-sm text-forest-800">{formatCurrency(details.ownerNetIncome as number)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Timeline */}
              <div>
                <p className="label-text">{t("request.desiredTimeline")}</p>
                <p className="font-body text-sm text-forest-800">
                  {detailRequest.desiredTimeline
                    ? t(TIMELINE_LABEL_KEYS[detailRequest.desiredTimeline] ?? detailRequest.desiredTimeline)
                    : "—"}
                </p>
              </div>

              {/* Notes */}
              {detailRequest.notes && (
                <div>
                  <p className="label-text">{t("admin.borrowerNotes")}</p>
                  <p className="font-body text-sm text-forest-700/80 bg-cream-50 rounded-lg p-3">{detailRequest.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conversation Chat Modal */}
      {(chatConversation || chatLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => { if (!chatLoading) setChatConversation(null); }} />
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up rounded-2xl bg-white shadow-2xl overflow-hidden">
            <button
              onClick={() => setChatConversation(null)}
              className="absolute right-4 top-4 z-10 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {chatLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-6 w-6 text-forest-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : chatConversation && (
              <>
                {/* Chat Header */}
                <div className="px-8 pt-8 pb-4 border-b border-cream-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="heading-md">{t("admin.userDetail.chatLog")}</h3>
                    <span className="font-mono text-xs text-forest-700/50">{chatConversation.publicId}</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase ${chatConversation.status === "ACTIVE" ? "bg-forest-100 text-forest-700" : "bg-sage-100 text-sage-600"}`}>
                      {chatConversation.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="label-text">{t("admin.borrowerLabel")}</p>
                      <p className="font-body text-sm font-semibold text-forest-800">{chatConversation.borrower.name || "—"}</p>
                      <p className="font-body text-xs text-forest-700/60">{chatConversation.borrower.email}</p>
                    </div>
                    <div>
                      <p className="label-text">{t("admin.brokerLabel")}</p>
                      <p className="font-body text-sm font-semibold text-forest-800">{chatConversation.broker.user.name || "—"}</p>
                      <p className="font-body text-xs text-forest-700/60">{chatConversation.broker.brokerageName}</p>
                    </div>
                    <div>
                      <p className="label-text">{t("admin.relatedRequest")}</p>
                      <p className="font-body text-sm text-forest-800">
                        {chatConversation.request.mortgageCategory === "COMMERCIAL"
                          ? t("request.commercial")
                          : t("request.residential")} · {chatConversation.request.province}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto bg-cream-50 px-4 py-6 space-y-4 max-h-[500px]">
                  {chatConversation.messages.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-body-sm">{t("admin.noMessages")}</p>
                    </div>
                  ) : (
                    chatConversation.messages.map((msg) => {
                      const roleInfo = ROLE_COLORS[msg.sender.role] || ROLE_COLORS.BORROWER;
                      const isBorrower = msg.sender.role === "BORROWER";
                      const isBroker = msg.sender.role === "BROKER";
                      const isAdmin = msg.sender.role === "ADMIN";

                      if (isAdmin) {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <div className="max-w-[85%] rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                              <p className="font-body text-xs font-semibold text-amber-700 mb-1">
                                {msg.sender.name || t("admin.userDetail.adminLabel")}
                              </p>
                              <p className="font-body text-sm text-amber-800 whitespace-pre-wrap break-words">{msg.body}</p>
                              <p className="font-body text-[10px] text-amber-600/60 mt-1.5">{formatDateTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`flex ${isBroker ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] ${isBroker ? "order-2" : ""}`}>
                            <div className={`flex items-center gap-1.5 mb-1 ${isBroker ? "justify-end" : ""}`}>
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase ${roleInfo.bg} ${roleInfo.text}`}>
                                {isBorrower ? "B" : "K"}
                              </span>
                              <span className="font-body text-[11px] font-medium text-forest-700/60">
                                {msg.sender.name || msg.sender.email}
                              </span>
                            </div>
                            <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                              isBorrower
                                ? "bg-white border border-cream-200 rounded-tl-md"
                                : "bg-forest-600 text-white rounded-tr-md"
                            }`}>
                              <p className={`font-body text-sm whitespace-pre-wrap break-words ${
                                isBorrower ? "text-forest-800" : "text-white"
                              }`}>
                                {msg.body}
                              </p>
                            </div>
                            <p className={`font-body text-[10px] text-forest-700/40 mt-1 ${isBroker ? "text-right" : ""}`}>
                              {formatDateTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer link */}
                <div className="px-8 py-4 border-t border-cream-200 flex justify-end">
                  <Link
                    href={`/admin/conversations/${chatConversation.id}`}
                    className="btn-secondary !px-4 !py-2 !text-xs !rounded-lg"
                    onClick={() => setChatConversation(null)}
                  >
                    {t("admin.userDetail.openFullConversation")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});
