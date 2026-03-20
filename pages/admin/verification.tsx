import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";

type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

interface PendingBroker {
  id: string;
  userName: string;
  brokerageName: string;
  licenseNumber: string;
  province: string;
  dateApplied: string;
}


export default function AdminVerification() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [pending, setPending] = useState<PendingBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchPending = async () => {
      try {
        const res = await fetch("/api/admin/brokers");
        if (res.ok) {
          const data = await res.json();
          setPending(
            data
              .filter((b: any) => b.verificationStatus === "PENDING")
              .map((b: any) => ({
                id: b.id,
                userName: b.user?.name ?? "Unknown",
                brokerageName: b.brokerageName,
                licenseNumber: b.licenseNumber,
                province: b.province,
                dateApplied: b.createdAt?.slice(0, 10) ?? "",
              }))
          );
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, [session, status, router]);

  const handleDecision = async (
    brokerId: string,
    decision: VerificationStatus
  ) => {
    setActionLoading(brokerId);
    try {
      const res = await fetch(`/api/admin/brokers/${brokerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: decision }),
      });

      if (res.ok) {
        setPending((prev) => prev.filter((b) => b.id !== brokerId));
      }
    } catch {
      // Network error - silently fail for now
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading verification queue...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("admin.verificationQueue")}</h1>
          <p className="text-body mt-2">
            {pending.length} broker{pending.length !== 1 ? "s" : ""} awaiting
            verification
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="card-elevated text-center py-16 animate-fade-in-up opacity-0 stagger-1">
            <div className="flex justify-center mb-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-100 text-forest-600">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </span>
            </div>
            <p className="font-body text-sm font-medium text-forest-800">
              All caught up!
            </p>
            <p className="text-body-sm mt-1">
              No pending verifications at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {pending.map((broker, index) => (
              <div
                key={broker.id}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-body text-sm font-bold">
                        {broker.userName.charAt(0)}
                      </span>
                      <div>
                        <h3 className="font-body text-base font-semibold text-forest-800">
                          {broker.userName}
                        </h3>
                        <p className="text-body-sm">
                          {broker.brokerageName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 ml-[52px]">
                      <span className="inline-flex items-center gap-1.5 text-body-sm">
                        <svg className="h-3.5 w-3.5 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                        </svg>
                        <span className="font-mono">{broker.licenseNumber}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-body-sm">
                        <svg className="h-3.5 w-3.5 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                        {broker.province}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-body-sm">
                        <svg className="h-3.5 w-3.5 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        Applied {broker.dateApplied}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 sm:ml-4">
                    <button
                      onClick={() =>
                        handleDecision(broker.id, "VERIFIED")
                      }
                      disabled={actionLoading === broker.id}
                      className="btn-primary !py-2 !px-5 disabled:opacity-50"
                    >
                      {actionLoading === broker.id ? "..." : t("admin.approve")}
                    </button>
                    <button
                      onClick={() =>
                        handleDecision(broker.id, "REJECTED")
                      }
                      disabled={actionLoading === broker.id}
                      className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2 font-body text-sm font-semibold text-white transition-all duration-300 hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-600/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {actionLoading === broker.id ? "..." : t("admin.reject")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "en", ["common"])),
    },
  };
};
