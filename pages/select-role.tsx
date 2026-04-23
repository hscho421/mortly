import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useSession } from "next-auth/react";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";

export default function SelectRolePage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [role, setRole] = useState<"BORROWER" | "BROKER">("BORROWER");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-select role from query param
  const queryRole = (router.query.role as string)?.toUpperCase();
  useEffect(() => {
    if (queryRole === "BORROWER" || queryRole === "BROKER") {
      setRole(queryRole);
    }
  }, [queryRole]);

  // Redirect if not authenticated or doesn't need role selection
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!session.user.needsRoleSelection) {
      const dest =
        session.user.role === "BROKER"
          ? "/broker/dashboard"
          : session.user.role === "ADMIN"
            ? "/admin/inbox"
            : "/borrower/dashboard";
      router.replace(dest);
    }
  }, [session, status, router]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || t("common.somethingWentWrong"));
        setIsLoading(false);
        return;
      }

      // Refresh the session to pick up the new role
      await update();

      const dest = role === "BROKER" ? "/broker/dashboard" : "/borrower/dashboard";
      router.push(dest);
    } catch {
      setError(t("common.unexpectedError"));
      setIsLoading(false);
    }
  };

  if (status === "loading" || !session?.user?.needsRoleSelection) {
    return (
      <Layout>
        <Head>
          <title>{t("titles.selectRole")}</title>
        </Head>
        <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300 border-t-forest-700" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{t("titles.selectRole")}</title>
      </Head>
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center opacity-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-400" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                mortly
              </span>
              <div className="h-px w-8 bg-amber-400" />
            </div>
          </div>

          <div className="card-elevated opacity-0 animate-fade-in-up stagger-1">
            <div className="mb-8 text-center">
              <h1 className="heading-lg mb-2">{t("auth.selectRoleTitle")}</h1>
              <p className="text-body-sm">{t("auth.selectRoleSubtitle")}</p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="opacity-0 animate-fade-in-up stagger-2">
              <label className="label-text">{t("auth.role")}</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("BORROWER")}
                  className={`rounded-xl border-2 px-4 py-3 font-body text-sm font-medium transition-all duration-200 ${
                    role === "BORROWER"
                      ? "border-forest-700 bg-forest-50 text-forest-800 shadow-sm"
                      : "border-cream-300 bg-white text-sage-600 hover:border-sage-300 hover:bg-cream-50"
                  }`}
                >
                  {t("auth.borrower")}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("BROKER")}
                  className={`rounded-xl border-2 px-4 py-3 font-body text-sm font-medium transition-all duration-200 ${
                    role === "BROKER"
                      ? "border-forest-700 bg-forest-50 text-forest-800 shadow-sm"
                      : "border-cream-300 bg-white text-sage-600 hover:border-sage-300 hover:bg-cream-50"
                  }`}
                >
                  {t("auth.broker")}
                </button>
              </div>
            </div>

            <div className="mt-6 opacity-0 animate-fade-in-up stagger-3">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? t("common.loading") : t("auth.selectRoleBtn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
