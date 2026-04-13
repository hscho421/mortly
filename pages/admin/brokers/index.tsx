import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
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
  const [rejectModalBrokerId, setRejectModalBrokerId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const initialStatus = (router.query.status as string) || "ALL";
  const [filterStatus, setFilterStatus] = useState<
    VerificationStatus | "ALL"
  >(["PENDING", "VERIFIED", "REJECTED"].includes(initialStatus) ? initialStatus as VerificationStatus : "ALL");
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

  // Sync filter from query param changes (e.g. navigating from dashboard links)
  useEffect(() => {
    const qs = router.query.status as string | undefined;
    if (qs && ["PENDING", "VERIFIED", "REJECTED"].includes(qs)) {
      setFilterStatus(qs as VerificationStatus);
      setPage(1);
    }
  }, [router.query.status]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;

    fetchBrokers(page, filterStatus);
  }, [session, status, page, filterStatus, fetchBrokers]);

  const handleFilterChange = (newStatus: VerificationStatus | "ALL") => {
    setFilterStatus(newStatus);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusChange = async (
    brokerId: string,
    newStatus: VerificationStatus,
    reason?: string
  ) => {
    setActionLoading(brokerId);
    try {
      const res = await fetch(`/api/admin/brokers/${brokerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: newStatus, ...(reason ? { reason } : {}) }),
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

  const handleRejectConfirm = async () => {
    if (!rejectModalBrokerId || !rejectionReason.trim()) return;
    await handleStatusChange(rejectModalBrokerId, "REJECTED", rejectionReason.trim());
    setRejectModalBrokerId(null);
    setRejectionReason("");
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading brokers...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminBrokers")}</title></Head>
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
                            onClick={() => {
                              setRejectModalBrokerId(broker.id);
                              setRejectionReason("");
                            }}
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

      {/* Rejection Reason Modal */}
      {rejectModalBrokerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <h3 className="heading-sm mb-2">{t("admin.rejectBrokerTitle")}</h3>
            <p className="text-body-sm mb-4">{t("admin.rejectBrokerDesc")}</p>
            <label htmlFor="rejectionReason" className="label-text">
              {t("admin.rejectionReason")}
            </label>
            <textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="input-field mt-1 w-full resize-none"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalBrokerId(null);
                  setRejectionReason("");
                }}
                className="btn-secondary !px-4 !py-2 !text-sm"
              >
                {t("nav.logoutCancel")}
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim() || actionLoading === rejectModalBrokerId}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 font-body text-sm font-semibold text-white transition-all duration-300 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading === rejectModalBrokerId ? "..." : t("admin.rejectBrokerConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "ko", ["common"])),
    },
  };
};
