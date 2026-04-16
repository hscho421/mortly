import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";

interface BadgeCounts {
  pendingVerifications: number;
  pendingRequests: number;
  openReports: number;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  badgeKey?: keyof BadgeCounts;
}

const NAV_SECTIONS: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: "admin.sidebar.overview",
    items: [
      {
        href: "/admin/dashboard",
        labelKey: "admin.sidebar.dashboard",
        icon: "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z",
      },
    ],
  },
  {
    labelKey: "admin.sidebar.actionRequired",
    items: [
      {
        href: "/admin/brokers?status=PENDING",
        labelKey: "admin.sidebar.verification",
        icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
        badgeKey: "pendingVerifications",
      },
      {
        href: "/admin/requests?status=PENDING_APPROVAL",
        labelKey: "admin.sidebar.requestApprovals",
        icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z",
        badgeKey: "pendingRequests",
      },
    ],
  },
  {
    labelKey: "admin.sidebar.management",
    items: [
      {
        href: "/admin/users",
        labelKey: "admin.sidebar.users",
        icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
      },
      {
        href: "/admin/brokers",
        labelKey: "admin.sidebar.brokers",
        icon: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
      },
      {
        href: "/admin/requests",
        labelKey: "admin.sidebar.requests",
        icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
      },
      {
        href: "/admin/conversations",
        labelKey: "admin.sidebar.conversations",
        icon: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
      },
    ],
  },
  {
    labelKey: "admin.sidebar.moderation",
    items: [
      {
        href: "/admin/reports",
        labelKey: "admin.sidebar.reports",
        icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
        badgeKey: "openReports",
      },
    ],
  },
  {
    labelKey: "admin.sidebar.system",
    items: [
      {
        href: "/admin/settings",
        labelKey: "admin.sidebar.settings",
        icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
      },
      {
        href: "/admin/manual",
        labelKey: "admin.sidebar.manual",
        icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
      },
    ],
  },
];

interface AdminSidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AdminSidebarNav({ collapsed, onToggle }: AdminSidebarNavProps) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [badges, setBadges] = useState<BadgeCounts>({
    pendingVerifications: 0,
    pendingRequests: 0,
    openReports: 0,
  });
  const [badgesLoaded, setBadgesLoaded] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        // Prefer direct count field (requestsByStatus.pendingApproval) over
        // pendingApprovalList.length because the list is capped at 10 items.
        const pendingRequestsCount =
          typeof data.requestsByStatus?.pendingApproval === "number"
            ? data.requestsByStatus.pendingApproval
            : Array.isArray(data.pendingApprovalList)
            ? data.pendingApprovalList.length
            : 0;
        setBadges({
          pendingVerifications: data.pendingVerifications ?? 0,
          pendingRequests: pendingRequestsCount,
          openReports: data.openReports ?? 0,
        });
        setBadgesLoaded(true);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await fetchBadges();
    };
    run();
    const intervalId = setInterval(run, 60000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchBadges]);

  // Collect all query-param hrefs so plain items can exclude them
  const queryHrefs = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((item) => item.href.includes("?"))
    .map((item) => item.href);

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return router.pathname === "/admin/dashboard";

    const [path, query] = href.split("?");

    // Query-param link (e.g. /admin/brokers?status=PENDING): match only when query is present
    if (query) {
      return router.asPath.startsWith(path) && router.asPath.includes(query);
    }

    // Plain link (e.g. /admin/brokers): match pathname but NOT if a query-param sibling is active
    if (router.pathname.startsWith(href)) {
      const matchedQueryHref = queryHrefs.find((qh) => {
        const [qPath, qQuery] = qh.split("?");
        return router.asPath.startsWith(qPath) && router.asPath.includes(qQuery);
      });
      if (matchedQueryHref) return false;
      return true;
    }

    return false;
  };

  return (
    <aside
      className={`sticky top-0 h-[calc(100vh-4rem)] shrink-0 border-r border-cream-200 bg-cream-50 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Toggle */}
        <div className="flex items-center justify-end px-3 py-3 border-b border-cream-200">
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-forest-600 hover:bg-cream-200 transition-colors"
            title={collapsed ? t("admin.sidebar.expand") : t("admin.sidebar.collapse")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey}>
              {!collapsed && (
                <p className="mb-1.5 px-2 font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-700/40">
                  {t(section.labelKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-body text-sm transition-all ${
                          active
                            ? "bg-forest-700 text-white shadow-sm"
                            : "text-forest-700 hover:bg-cream-200"
                        } ${collapsed ? "justify-center" : ""}`}
                        title={collapsed ? t(item.labelKey) : undefined}
                      >
                        <svg
                          className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-forest-600/70"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{t(item.labelKey)}</span>
                            {badgesLoaded && badgeCount > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5">
                                {badgeCount}
                              </span>
                            )}
                          </>
                        )}
                        {collapsed && badgesLoaded && badgeCount > 0 && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
