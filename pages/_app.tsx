import "@/styles/globals.css";
import { useState, useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider, useSession } from "next-auth/react";
import { appWithTranslation } from "next-i18next";
import { Analytics } from "@vercel/analytics/react";
import { DM_Serif_Display, Outfit, Noto_Sans_KR } from "next/font/google";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-korean",
  display: "swap",
  preload: true,
});

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
            MortgageMatch is temporarily undergoing scheduled maintenance.
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
    <>
      <style jsx global>{`
        :root {
          --font-display: ${dmSerif.style.fontFamily};
          --font-body: ${outfit.style.fontFamily};
          --font-korean: ${notoSansKR.style.fontFamily};
        }
      `}</style>
      <SessionProvider session={session}>
        <MaintenanceGate>
          <Component {...pageProps} />
        </MaintenanceGate>
        <Analytics />
      </SessionProvider>
    </>
  );
}

export default appWithTranslation(App);
