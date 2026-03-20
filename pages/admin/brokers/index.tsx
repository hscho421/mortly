import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";

type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
type SubscriptionTier = "BASIC" | "PRO" | "PREMIUM";

interface BrokerRow {
  id: string;
  userPublicId: string;
  userName: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  verificationStatus: VerificationStatus;
  subscriptionTier: SubscriptionTier;
  rating: number | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TIER_BADGE: Record<SubscriptionTier, string> = {
  BASIC: "bg-cream-200 text-forest-600 ring-1 ring-inset ring-cream-400/30",
  PRO: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  PREMIUM: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
};

export default function AdminBrokers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    VerificationStatus | "ALL"
  >("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchBrokers = useCallback(async (currentPage: number, statusFilter: VerificationStatus | "ALL") => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/brokers?page=${currentPage}&limit=20&status=${statusFilter}`
      );
      if (res.ok) {
        const json = await res.json();
        setBrokers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          json.data.map((b: any) => ({
            id: b.id,
            userPublicId: b.user?.publicId ?? "—",
            userName: b.user?.name ?? "Unknown",
            brokerageName: b.brokerageName,
            province: b.province,
            licenseNumber: b.licenseNumber,
            verificationStatus: b.verificationStatus,
            subscriptionTier: b.subscriptionTier,
            rating: b.rating,
          }))
        );
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    fetchBrokers(page, filterStatus);
  }, [session, status, router, page, filterStatus, fetchBrokers]);

  const handleFilterChange = (newStatus: VerificationStatus | "ALL") => {
    setFilterStatus(newStatus);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusChange = async (
    brokerId: string,
    newStatus: VerificationStatus
  ) => {
    setActionLoading(brokerId);
    try {
      const res = await fetch(`/api/admin/brokers/${brokerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: newStatus }),
      });

      if (res.ok) {
        await fetchBrokers(page, filterStatus);
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
          <p className="text-body-sm">Loading brokers...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="heading-lg">{t("admin.brokerManagement")}</h1>
            <p className="text-body mt-2">
              {t("admin.brokerManagementDescription", "View, verify, and manage broker accounts across the platform.")}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <label htmlFor="statusFilter" className="label-text">
              {t("admin.filterByStatus", "Filter by status")}
            </label>
            <select
              id="statusFilter"
              value={filterStatus}
              onChange={(e) =>
                handleFilterChange(
                  e.target.value as VerificationStatus | "ALL"
                )
              }
              className="input-field w-auto min-w-[160px]"
            >
              <option value="ALL">{t("admin.allStatuses", "All Statuses")}</option>
              <option value="PENDING">{t("status.pending")}</option>
              <option value="VERIFIED">{t("status.verified")}</option>
              <option value="REJECTED">{t("status.rejected")}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up opacity-0 stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    User ID
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Name
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Brokerage
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Province
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    License #
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Tier
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Rating
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {brokers.map((broker) => (
                  <tr key={broker.id} className="hover:bg-cream-50 transition-colors">
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-forest-700/70">
                      {broker.userPublicId}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm font-semibold text-forest-800">
                      {broker.userName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm text-forest-700/80">
                      {broker.brokerageName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm text-forest-700/80">
                      {broker.province}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-forest-700/80">
                      {broker.licenseNumber}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge status={broker.verificationStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${TIER_BADGE[broker.subscriptionTier]}`}
                      >
                        {broker.subscriptionTier}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {broker.rating !== null ? (
                        <span className="inline-flex items-center gap-1 font-body text-sm text-forest-800">
                          <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {broker.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="font-body text-sm text-sage-400">--</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            router.push(`/admin/brokers/${broker.id}`, undefined, { locale: router.locale })
                          }
                          className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          {t("admin.view")}
                        </button>
                        {broker.verificationStatus !== "VERIFIED" && (
                          <button
                            onClick={() =>
                              handleStatusChange(broker.id, "VERIFIED")
                            }
                            disabled={actionLoading === broker.id}
                            className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === broker.id
                              ? "..."
                              : t("admin.verify")}
                          </button>
                        )}
                        {broker.verificationStatus !== "REJECTED" && (
                          <button
                            onClick={() =>
                              handleStatusChange(broker.id, "REJECTED")
                            }
                            disabled={actionLoading === broker.id}
                            className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all duration-300 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                          >
                            {actionLoading === broker.id
                              ? "..."
                              : t("admin.suspend")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {brokers.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-12 text-center text-body-sm"
                    >
                      No brokers found for the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={handlePageChange}
        />
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
