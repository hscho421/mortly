import "@/styles/globals.css";
import React, { useState, useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider, useSession } from "next-auth/react";
import { appWithTranslation, useTranslation } from "next-i18next";
import { Analytics } from "@vercel/analytics/react";
import { ToastProvider } from "@/components/Toast";
import { AdminDataProvider } from "@/lib/admin/AdminDataContext";

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <div className="card-elevated max-w-lg text-center">
        <h1 className="heading-lg mb-3">{t("common.somethingWentWrong")}</h1>
        <p className="text-body mb-4">{t("common.unexpectedError")}</p>
        <button onClick={onRetry} className="btn-primary">
          {t("common.tryAgain")}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback onRetry={() => this.setState({ hasError: false })} />
      );
    }
    return this.props.children;
  }
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance")
      .then((r) => r.json())
      .then((d) => setMaintenance(d.maintenance))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const isAdmin = session?.user?.role === "ADMIN";
  const isAuthRoute = router.pathname.startsWith("/login") || router.pathname.startsWith("/signup");
  const isApiRoute = router.pathname.startsWith("/api");

  // Maintenance gate applies to everything except API (server logic stays open)
  // and the auth routes (needed so admins can sign in during maintenance).
  // Admins bypass it regardless of route — including /admin/* so they can
  // finish fixing whatever triggered maintenance mode.
  if (checked && maintenance && !isAdmin && !isAuthRoute && !isApiRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <div className="card-elevated max-w-lg text-center">
          <div className="mb-4 text-4xl">🔧</div>
          <h1 className="heading-lg mb-3">{t("common.maintenanceTitle")}</h1>
          <p className="text-body mb-2">
            {t("common.maintenanceDesc")}
          </p>
          <p className="text-body-sm text-sage-500">
            {t("common.maintenanceNote")}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
}

/**
 * Mount AdminDataProvider only on /admin/* routes. This keeps the shared
 * badge + inbox polling loop from running on public pages where it would be
 * wasted work (and would 401 since the viewer isn't an admin).
 */
function AdminScope({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith("/admin");
  if (!isAdminRoute) return <>{children}</>;
  return <AdminDataProvider>{children}</AdminDataProvider>;
}

function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  useServiceWorker();
  return (
    <SessionProvider session={session} refetchInterval={60} refetchOnWindowFocus={true}>
      <ToastProvider>
        <ErrorBoundary>
          <MaintenanceGate>
            <AdminScope>
              <Component {...pageProps} />
            </AdminScope>
          </MaintenanceGate>
        </ErrorBoundary>
      </ToastProvider>
      <Analytics />
    </SessionProvider>
  );
}

export default appWithTranslation(App);
