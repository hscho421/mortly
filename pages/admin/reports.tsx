import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";

type ReportStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED";

interface ReportRow {
  id: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

const MOCK_REPORTS: ReportRow[] = [
  {
    id: "rpt_1",
    reporterName: "John Smith",
    targetType: "Broker",
    targetId: "brk_6",
    reason: "Misleading profile information about experience and credentials",
    status: "OPEN",
    createdAt: "2026-03-18",
  },
  {
    id: "rpt_2",
    reporterName: "Alice Johnson",
    targetType: "Message",
    targetId: "msg_482",
    reason: "Inappropriate language and unprofessional conduct",
    status: "OPEN",
    createdAt: "2026-03-18",
  },
  {
    id: "rpt_3",
    reporterName: "Bob Williams",
    targetType: "Broker",
    targetId: "brk_12",
    reason: "Suspected unlicensed activity in Ontario",
    status: "REVIEWED",
    createdAt: "2026-03-17",
  },
  {
    id: "rpt_4",
    reporterName: "Carol Davis",
    targetType: "Message",
    targetId: "msg_391",
    reason: "Spam messages soliciting external services",
    status: "RESOLVED",
    createdAt: "2026-03-16",
  },
  {
    id: "rpt_5",
    reporterName: "Dan Miller",
    targetType: "Broker",
    targetId: "brk_8",
    reason: "Profile photo does not match person during consultation",
    status: "DISMISSED",
    createdAt: "2026-03-15",
  },
  {
    id: "rpt_6",
    reporterName: "Eva Martinez",
    targetType: "Message",
    targetId: "msg_520",
    reason: "Requesting personal financial information outside the platform",
    status: "OPEN",
    createdAt: "2026-03-19",
  },
];

export default function AdminReports() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "ALL">(
    "ALL"
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login");
      return;
    }

    const timer = setTimeout(() => {
      setReports(MOCK_REPORTS);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [session, status, router]);

  const handleStatusChange = async (
    reportId: string,
    newStatus: ReportStatus
  ) => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId ? { ...r, status: newStatus } : r
          )
        );
      }
    } catch {
      // Network error - silently fail for now
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReports =
    filterStatus === "ALL"
      ? reports
      : reports.filter((r) => r.status === filterStatus);

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading reports...</p>
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
            <h1 className="heading-lg">Reports &amp; Moderation</h1>
            <p className="text-body mt-2">
              Review and resolve user-submitted reports.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <label htmlFor="reportStatusFilter" className="label-text">
              Filter by status
            </label>
            <select
              id="reportStatusFilter"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as ReportStatus | "ALL")
              }
              className="input-field w-auto min-w-[160px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
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
                    Reporter
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Target Type
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Target ID
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Reason
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-cream-50 transition-colors">
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm font-semibold text-forest-800">
                      {report.reporterName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${
                        report.targetType === "Broker"
                          ? "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20"
                          : "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20"
                      }`}>
                        {report.targetType}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-forest-700/80">
                      {report.targetId}
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 font-body text-sm text-forest-700/80" title={report.reason}>
                      {report.reason}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm text-forest-700/80">
                      {report.createdAt}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        {report.status === "OPEN" && (
                          <button
                            onClick={() =>
                              handleStatusChange(report.id, "REVIEWED")
                            }
                            disabled={actionLoading === report.id}
                            className="btn-amber !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === report.id
                              ? "..."
                              : "Mark Reviewed"}
                          </button>
                        )}
                        {(report.status === "OPEN" ||
                          report.status === "REVIEWED") && (
                          <>
                            <button
                              onClick={() =>
                                handleStatusChange(report.id, "RESOLVED")
                              }
                              disabled={actionLoading === report.id}
                              className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                            >
                              {actionLoading === report.id
                                ? "..."
                                : "Resolve"}
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(report.id, "DISMISSED")
                              }
                              disabled={actionLoading === report.id}
                              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all duration-300 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                            >
                              {actionLoading === report.id
                                ? "..."
                                : "Dismiss"}
                            </button>
                          </>
                        )}
                        {(report.status === "RESOLVED" ||
                          report.status === "DISMISSED") && (
                          <span className="font-body text-xs text-sage-400">
                            No actions available
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-body-sm"
                    >
                      No reports found for the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
