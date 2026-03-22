import "@/styles/globals.css";
import { useState, useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { SessionProvider, useSession } from "next-auth/react";
import { appWithTranslation } from "next-i18next";
import { Analytics } from "@vercel/analytics/react";

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
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
          <h1 className="heading-lg mb-3">Under Maintenance</h1>
          <p className="text-body mb-2">
            mortly is temporarily undergoing scheduled maintenance.
          </p>
          <p className="text-body-sm text-sage-500">
            We&apos;ll be back shortly. Thank you for your patience.
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
      <Head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </Head>
      <MaintenanceGate>
        <Component {...pageProps} />
      </MaintenanceGate>
      <Analytics />
    </SessionProvider>
  );
}

export default appWithTranslation(App);
