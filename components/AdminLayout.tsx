import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import Layout from "./Layout";
import AdminSidebarNav from "./AdminSidebarNav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
    }
  }, [session, status, router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [router.pathname]);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("common.loading")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-160px)]">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-forest-700 text-white shadow-lg lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile sidebar drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AdminSidebarNav collapsed={false} onToggle={() => setMobileOpen(false)} />
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <AdminSidebarNav collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </Layout>
  );
}
