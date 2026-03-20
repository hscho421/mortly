import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";

interface BrokerDetail {
  id: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  mortgageCategory: string;
  bio: string | null;
  yearsExperience: number | null;
  areasServed: string | null;
  specialties: string | null;
  profilePhoto: string | null;
  verificationStatus: string;
  subscriptionTier: string;
  rating: number | null;
  completedMatches: number;
  responseCredits: number;
  createdAt: string;
  user: {
    id: string;
    publicId: string;
    name: string | null;
    email: string;
    status: string;
    createdAt: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    borrower: { id: string; name: string | null };
  }>;
  introductions: Array<{
    id: string;
    createdAt: string;
    request: {
      id: string;
      requestType: string;
      province: string;
      city: string | null;
      status: string;
    };
  }>;
  conversations: Array<{
    id: string;
    status: string;
    updatedAt: string;
    borrower: { id: string; name: string | null; email: string };
    request: { id: string; requestType: string; province: string };
    _count: { messages: number };
  }>;
  subscription: {
    id: string;
    tier: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
  } | null;
  creditPurchases: Array<{
    id: string;
    packType: string;
    credits: number;
    amount: number;
    createdAt: string;
  }>;
  _count: {
    introductions: number;
    conversations: number;
    reviews: number;
    creditPurchases: number;
  };
}

const STATUS_BADGE: Record<string, string> = {
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

const USER_STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-forest-100 text-forest-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  BANNED: "bg-rose-100 text-rose-700",
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

export default function AdminBrokerDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("common");
  const [broker, setBroker] = useState<BrokerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchBroker = async () => {
      try {
        const res = await fetch(`/api/admin/brokers/${id}`);
        if (res.ok) {
          setBroker(await res.json());
        } else {
          setError("Broker not found");
        }
      } catch {
        setError("Failed to load broker");
      } finally {
        setLoading(false);
      }
    };

    fetchBroker();
  }, [session, status, router, id]);

  const handleVerificationChange = async (newStatus: string) => {
    if (!broker) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/brokers/${broker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: newStatus }),
      });

      if (res.ok) {
        setBroker((prev) => prev ? { ...prev, verificationStatus: newStatus } : prev);
        setActionMessage({ text: t("admin.statusUpdated"), ok: true });
      } else {
        const data = await res.json();
        setActionMessage({ text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ text: "Failed to update", ok: false });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingBroker", "Loading broker...")}</p>
        </div>
      </Layout>
    );
  }

  if (error || !broker) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <p className="text-body-sm text-rose-600">{error || "Broker not found"}</p>
          <Link href="/admin/brokers" className="btn-secondary mt-4 inline-block">
            {t("admin.backToBrokers", "Back to Brokers")}
          </Link>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/brokers"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.backToBrokers", "Back to Brokers")}
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="heading-lg">{broker.user.name || broker.brokerageName}</h1>
              <p className="font-mono text-xs text-forest-700/50 mt-1">User ID: {broker.user.publicId}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs font-semibold uppercase ${STATUS_BADGE[broker.verificationStatus]}`}>
                {broker.verificationStatus}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs font-semibold uppercase ${TIER_BADGE[broker.subscriptionTier]}`}>
                {broker.subscriptionTier}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs font-semibold uppercase ${USER_STATUS_BADGE[broker.user.status]}`}>
                {broker.user.status}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-1">
          <h2 className="heading-sm mb-4">{t("admin.brokerProfile", "Broker Profile")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="label-text">{t("admin.brokerage", "Brokerage")}</p>
              <p className="font-body text-sm font-semibold text-forest-800">{broker.brokerageName}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.email", "Email")}</p>
              <p className="font-body text-sm text-forest-800">{broker.user.email}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.licenseNumber", "License Number")}</p>
              <p className="font-mono text-sm text-forest-800">{broker.licenseNumber}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.province", "Province")}</p>
              <p className="font-body text-sm text-forest-800">{broker.province}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.category", "Category")}</p>
              <p className="font-body text-sm text-forest-800">{broker.mortgageCategory}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.experience", "Experience")}</p>
              <p className="font-body text-sm text-forest-800">
                {broker.yearsExperience != null ? `${broker.yearsExperience} years` : "—"}
              </p>
            </div>
            <div>
              <p className="label-text">{t("admin.areasServed", "Areas Served")}</p>
              <p className="font-body text-sm text-forest-800">{broker.areasServed || "—"}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.specialties", "Specialties")}</p>
              <p className="font-body text-sm text-forest-800">{broker.specialties || "—"}</p>
            </div>
            <div>
              <p className="label-text">{t("admin.memberSince", "Member Since")}</p>
              <p className="font-body text-sm text-forest-800">{formatDate(broker.user.createdAt)}</p>
            </div>
          </div>

          {broker.bio && (
            <div className="mt-4 border-t border-cream-200 pt-4">
              <p className="label-text">{t("admin.bio", "Bio")}</p>
              <p className="font-body text-sm text-forest-700/80 bg-cream-50 rounded-lg p-3">{broker.bio}</p>
            </div>
          )}
        </div>

        {/* Stats & Credits */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fade-in-up stagger-2">
          <div className="card-elevated text-center">
            <p className="font-display text-2xl text-forest-800">{broker.responseCredits}</p>
            <p className="text-body-sm">{t("admin.creditsRemaining", "Credits")}</p>
          </div>
          <div className="card-elevated text-center">
            <p className="font-display text-2xl text-forest-800">{broker._count.introductions}</p>
            <p className="text-body-sm">{t("admin.totalIntros", "Introductions")}</p>
          </div>
          <div className="card-elevated text-center">
            <p className="font-display text-2xl text-forest-800">{broker._count.conversations}</p>
            <p className="text-body-sm">{t("admin.totalConvos", "Conversations")}</p>
          </div>
          <div className="card-elevated text-center">
            <p className="font-display text-2xl text-amber-700">
              {broker.rating != null ? broker.rating.toFixed(1) : "—"}
            </p>
            <p className="text-body-sm">{broker._count.reviews} {t("admin.reviewsLabel", "reviews")}</p>
          </div>
        </div>

        {/* Verification Actions */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-3">
          <h2 className="heading-sm mb-4">{t("admin.verificationActions", "Verification Actions")}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {broker.verificationStatus !== "VERIFIED" && (
              <button
                onClick={() => handleVerificationChange("VERIFIED")}
                disabled={actionLoading}
                className="btn-primary !rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "..." : t("admin.approve")}
              </button>
            )}
            {broker.verificationStatus !== "REJECTED" && (
              <button
                onClick={() => handleVerificationChange("REJECTED")}
                disabled={actionLoading}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading ? "..." : t("admin.reject")}
              </button>
            )}
            {broker.verificationStatus !== "PENDING" && (
              <button
                onClick={() => handleVerificationChange("PENDING")}
                disabled={actionLoading}
                className="btn-secondary !rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "..." : t("admin.resetToPending", "Reset to Pending")}
              </button>
            )}
          </div>
          {actionMessage && (
            <p className={`mt-3 font-body text-sm ${actionMessage.ok ? "text-forest-600" : "text-rose-600"}`}>
              {actionMessage.text}
            </p>
          )}
        </div>

        {/* Recent Introductions */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-4">
          <h2 className="heading-sm mb-4">
            {t("admin.recentIntroductions", "Recent Introductions")} ({broker._count.introductions})
          </h2>
          {broker.introductions.length === 0 ? (
            <p className="text-body-sm">{t("admin.noIntroductions", "No introductions sent yet.")}</p>
          ) : (
            <div className="space-y-2">
              {broker.introductions.map((intro) => (
                <div key={intro.id} className="flex items-center justify-between rounded-lg bg-cream-50 px-4 py-3">
                  <div>
                    <p className="font-body text-sm text-forest-800">
                      {intro.request.requestType} · {intro.request.province}
                      {intro.request.city ? `, ${intro.request.city}` : ""}
                    </p>
                    <p className="font-body text-xs text-forest-700/50">
                      <span className={intro.request.status === "OPEN" ? "text-forest-600" : "text-sage-500"}>
                        {intro.request.status}
                      </span>{" "}
                      · {formatDate(intro.createdAt)}
                    </p>
                  </div>
                  <Link
                    href="/admin/requests"
                    className="font-body text-xs text-forest-600 hover:underline"
                  >
                    {t("admin.viewRequest", "View")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-5">
          <h2 className="heading-sm mb-4">
            {t("admin.recentConversations", "Recent Conversations")} ({broker._count.conversations})
          </h2>
          {broker.conversations.length === 0 ? (
            <p className="text-body-sm">{t("admin.noConversationsYet", "No conversations yet.")}</p>
          ) : (
            <div className="space-y-2">
              {broker.conversations.map((convo) => (
                <div key={convo.id} className="flex items-center justify-between rounded-lg bg-cream-50 px-4 py-3">
                  <div>
                    <p className="font-body text-sm text-forest-800">
                      {convo.borrower.name || convo.borrower.email} · {convo.request.requestType}
                    </p>
                    <p className="font-body text-xs text-forest-700/50">
                      <span className={convo.status === "ACTIVE" ? "text-forest-600" : "text-sage-500"}>
                        {convo.status}
                      </span>{" "}
                      · {convo._count.messages} msgs · {formatDateTime(convo.updatedAt)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/conversations/${convo.id}`}
                    className="font-body text-xs text-forest-600 hover:underline"
                  >
                    {t("admin.viewMessages", "Messages")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="card-elevated mb-6 animate-fade-in-up stagger-6">
          <h2 className="heading-sm mb-4">
            {t("admin.reviewsTitle", "Reviews")} ({broker._count.reviews})
          </h2>
          {broker.reviews.length === 0 ? (
            <p className="text-body-sm">{t("admin.noReviews", "No reviews yet.")}</p>
          ) : (
            <div className="space-y-3">
              {broker.reviews.map((review) => (
                <div key={review.id} className="rounded-lg bg-cream-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-amber-500">
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </span>
                      <span className="font-body text-sm font-semibold text-forest-800">
                        {review.borrower.name || "Anonymous"}
                      </span>
                    </div>
                    <span className="font-body text-xs text-forest-700/40">{formatDate(review.createdAt)}</span>
                  </div>
                  {review.comment && (
                    <p className="font-body text-sm text-forest-700/80 italic">&ldquo;{review.comment}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Credit Purchases */}
        {broker.creditPurchases.length > 0 && (
          <div className="card-elevated animate-fade-in-up stagger-7">
            <h2 className="heading-sm mb-4">
              {t("admin.creditPurchases", "Credit Purchases")} ({broker._count.creditPurchases})
            </h2>
            <div className="space-y-2">
              {broker.creditPurchases.map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between rounded-lg bg-cream-50 px-4 py-3">
                  <div>
                    <p className="font-body text-sm text-forest-800">
                      {purchase.packType} — {purchase.credits} credits
                    </p>
                    <p className="font-body text-xs text-forest-700/50">{formatDate(purchase.createdAt)}</p>
                  </div>
                  <span className="font-body text-sm font-semibold text-forest-800">
                    ${(purchase.amount / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
