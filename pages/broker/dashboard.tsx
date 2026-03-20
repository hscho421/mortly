import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

interface BrokerProfile {
  id: string;
  userId: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  verificationStatus: string;
  subscriptionTier: string;
  responseCredits: number;
  introductions?: { id: string }[];
  user: { id: string; name: string | null; email: string };
  subscription: { id: string; tier: string; status: string } | null;
}

interface BorrowerRequest {
  id: string;
  status: string;
  introductions: { brokerId: string; broker: { userId: string } }[];
  _count: { introductions: number };
}

interface Conversation {
  id: string;
  status: string;
}

interface DashboardStats {
  openRequests: number;
  introductionsSent: number;
  activeConversations: number;
  responseCredits: number;
}

export default function BrokerDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    openRequests: 0,
    introductionsSent: 0,
    activeConversations: 0,
    responseCredits: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== "BROKER") {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    async function fetchDashboardData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch broker profile
        const profileRes = await fetch("/api/brokers/profile");

        if (profileRes.status === 404) {
          router.push("/broker/onboarding", undefined, { locale: router.locale });
          return;
        }

        if (!profileRes.ok) {
          throw new Error("Failed to fetch broker profile");
        }

        const brokerProfile: BrokerProfile = await profileRes.json();
        setProfile(brokerProfile);

        // Fetch requests and conversations in parallel
        const [requestsRes, conversationsRes] = await Promise.all([
          fetch("/api/requests"),
          fetch("/api/conversations"),
        ]);

        if (!requestsRes.ok) {
          throw new Error("Failed to fetch requests");
        }
        if (!conversationsRes.ok) {
          throw new Error("Failed to fetch conversations");
        }

        const requests: BorrowerRequest[] = await requestsRes.json();
        const conversations: Conversation[] = await conversationsRes.json();

        // Count open requests
        const openRequests = requests.length;

        // Count introductions sent by this broker
        const introductionsSent = requests.filter((req) =>
          req.introductions.some(
            (intro) => intro.broker.userId === session!.user.id
          )
        ).length;

        // Count active conversations
        const activeConversations = conversations.filter(
          (c) => c.status === "ACTIVE"
        ).length;

        setStats({
          openRequests,
          introductionsSent,
          activeConversations,
          responseCredits: brokerProfile.responseCredits,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-forest-300 border-t-forest-700" />
            <p className="text-body-sm">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-body mb-4 text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const subscriptionTier = profile?.subscriptionTier || "BASIC";
  const verificationStatus = profile?.verificationStatus || "PENDING";

  const tierColors: Record<string, string> = {
    BASIC: "bg-sage-100 text-sage-700",
    PRO: "bg-forest-100 text-forest-700",
    PREMIUM: "bg-amber-100 text-amber-700",
  };

  const verificationColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    VERIFIED: "bg-forest-100 text-forest-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  const statCards = [
    {
      label: t("broker.openRequests"),
      value: stats.openRequests,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      accent: false,
    },
    {
      label: t("broker.introsSent"),
      value: stats.introductionsSent,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      ),
      accent: false,
    },
    {
      label: t("broker.activeConvos"),
      value: stats.activeConversations,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
      accent: false,
    },
    {
      label: t("broker.responseCredits"),
      value: stats.responseCredits,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      accent: true,
    },
  ];

  const quickActions = [
    {
      href: "/broker/requests",
      label: t("broker.browseRequests"),
      colorBg: "bg-forest-100",
      colorText: "text-forest-600",
      colorHover: "group-hover:bg-forest-200",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      ),
    },
    {
      href: "/broker/introductions",
      label: t("broker.myIntroductions"),
      colorBg: "bg-forest-100",
      colorText: "text-forest-600",
      colorHover: "group-hover:bg-forest-200",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      ),
    },
    {
      href: "/broker/conversations",
      label: t("broker.conversations"),
      colorBg: "bg-sage-100",
      colorText: "text-sage-600",
      colorHover: "group-hover:bg-sage-200",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      ),
    },
    {
      href: "/broker/profile",
      label: t("broker.editProfile"),
      colorBg: "bg-amber-100",
      colorText: "text-amber-600",
      colorHover: "group-hover:bg-amber-200",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="heading-lg">
              {t("broker.welcome")}, {session.user.name || "Broker"}
            </h1>
            <p className="text-body mt-2">
              Here is an overview of your MortgageMatch activity.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 font-body text-xs font-semibold ${tierColors[subscriptionTier] || tierColors.BASIC}`}
            >
              {subscriptionTier} Plan
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 font-body text-xs font-semibold ${verificationColors[verificationStatus] || verificationColors.PENDING}`}
            >
              {verificationStatus === "VERIFIED"
                ? t("status.verified")
                : verificationStatus === "REJECTED"
                  ? t("status.rejected")
                  : t("status.pending")}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, i) => (
            <div
              key={stat.label}
              className={`card-elevated animate-fade-in-up stagger-${i + 1} ${
                stat.accent ? "border-amber-300 bg-amber-50/50" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-body-sm">{stat.label}</p>
                  <p className={`mt-2 font-display text-4xl tracking-tight ${
                    stat.accent ? "text-amber-700" : "text-forest-800"
                  }`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${
                  stat.accent ? "bg-amber-200/50 text-amber-700" : "bg-forest-100 text-forest-600"
                }`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h2 className="heading-md mb-5 animate-fade-in stagger-5">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up stagger-6">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card group flex items-center gap-4 px-6 py-5"
            >
              <div className={`rounded-xl p-3 ${action.colorBg} ${action.colorText} transition-colors ${action.colorHover}`}>
                {action.icon}
              </div>
              <span className="font-body text-sm font-semibold text-forest-800">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
