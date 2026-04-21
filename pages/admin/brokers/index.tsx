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

const TIER_TONE: Record<SubscriptionTier, "neutral" | "info" | "accent"> = {
  BASIC: "neutral",
  PRO: "info",
  PREMIUM: "accent",
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
        {/* Page Header — editorial */}
        <div className="mb-8 animate-fade-in">
          <div className="eyebrow">— {t("admin.sidebar.brokers")}</div>
          <h1 className="heading-lg mt-3">{t("admin.brokerManagement")}</h1>
          <p className="text-body mt-2 max-w-2xl">
            {t("admin.brokerManagementDescription", "View, verify, and manage broker accounts across the platform.")}
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5 pb-4 mb-6 border-b border-cream-300 animate-fade-in">
          {([
            { v: "ALL", label: t("admin.allStatuses", "All") },
            { v: "PENDING", label: t("status.pending") },
            { v: "VERIFIED", label: t("status.verified") },
            { v: "REJECTED", label: t("status.rejected") },
          ] as const).map((f) => {
            const on = filterStatus === f.v;
            return (
              <button
                key={f.v}
                onClick={() => handleFilterChange(f.v)}
                className={`px-3 py-1.5 font-body text-[12px] rounded-sm border transition-colors ${
                  on
                    ? "bg-forest-800 text-cream-50 border-forest-800 font-semibold"
                    : "bg-cream-50 text-forest-700 border-cream-300 hover:bg-cream-200"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="rounded-sm border border-cream-300 bg-cream-50 overflow-hidden animate-fade-in-up opacity-0 stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cream-100 border-b border-cream-300">
                  <th className="px-5 py-3 text-left mono-label">{t("admin.userId", "User ID")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("admin.user", "Name")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("admin.brokerage", "Brokerage")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("admin.province", "Province")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("admin.licenseNumber", "License #")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("admin.statusLabel", "Status")}</th>
                  <th className="px-5 py-3 text-left mono-label">{t("broker.currentPlan", "Tier")}</th>
                  <th className="px-5 py-3 text-right mono-label">{t("admin.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((broker, i) => (
                  <tr key={broker.id} className={`${i < brokers.length - 1 ? "border-b border-cream-200" : ""} hover:bg-cream-100 transition-colors`}>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-forest-700/70">
                      {broker.userPublicId}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-body text-sm font-medium text-forest-800">
                      {broker.userName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-body text-sm text-forest-700/80">
                      {broker.brokerageName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-body text-sm text-forest-700/80">
                      {broker.province}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-forest-700/80">
                      {broker.licenseNumber}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <StatusBadge status={broker.verificationStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className={`badge-${TIER_TONE[broker.subscriptionTier]}`}>
                        {broker.subscriptionTier}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() =>
                            router.push(`/admin/brokers/${broker.id}`, undefined, { locale: router.locale })
                          }
                          className="rounded-sm border border-cream-300 bg-cream-50 text-forest-800 px-3 py-1.5 font-body text-xs font-semibold hover:bg-cream-200"
                        >
                          {t("admin.view")}
                        </button>
                        {broker.verificationStatus !== "VERIFIED" && (
                          <button
                            onClick={() => handleStatusChange(broker.id, "VERIFIED")}
                            disabled={actionLoading === broker.id}
                            className="rounded-sm bg-success-700 text-white px-3 py-1.5 font-body text-xs font-semibold hover:bg-success-600 disabled:opacity-50"
                          >
                            {actionLoading === broker.id ? "..." : `✓ ${t("admin.verify")}`}
                          </button>
                        )}
                        {broker.verificationStatus !== "REJECTED" && (
                          <button
                            onClick={() => {
                              setRejectModalBrokerId(broker.id);
                              setRejectionReason("");
                            }}
                            disabled={actionLoading === broker.id}
                            className="rounded-sm border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 font-body text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                          >
                            {actionLoading === broker.id ? "..." : t("admin.suspend")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {brokers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-body-sm">
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
