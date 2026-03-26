import "@/styles/globals.css";
import React, { useState, useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider, useSession } from "next-auth/react";
import { appWithTranslation, useTranslation } from "next-i18next";
import { Analytics } from "@vercel/analytics/react";

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
        <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
          <div className="card-elevated max-w-lg text-center">
            <h1 className="heading-lg mb-3">Something went wrong</h1>
            <p className="text-body mb-4">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="btn-primary"
            >
              Try again
            </button>
          </div>
        </div>
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
  const isAdminRoute = router.pathname.startsWith("/admin");
  const isAuthRoute = router.pathname.startsWith("/login") || router.pathname.startsWith("/signup");
  const isApiRoute = router.pathname.startsWith("/api");

  if (checked && maintenance && !isAdmin && !isAdminRoute && !isAuthRoute && !isApiRoute) {
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

function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <MaintenanceGate>
          <Component {...pageProps} />
        </MaintenanceGate>
      </ErrorBoundary>
      <Analytics />
    </SessionProvider>
  );
}

export default appWithTranslation(App);
