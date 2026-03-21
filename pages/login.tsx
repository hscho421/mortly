import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

const ROLE_REDIRECTS: Record<string, string> = {
  BORROWER: "/borrower/request/new",
  BROKER: "/broker/dashboard",
  ADMIN: "/admin/dashboard",
};

export default function LoginPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // Fetch the session to get the user role for redirect
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;

      const callbackUrl = router.query.callbackUrl as string | undefined;
      const redirectUrl = callbackUrl || ROLE_REDIRECTS[role] || "/";
      router.push(redirectUrl, undefined, { locale: router.locale });
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Decorative top accent */}
          <div className="mb-8 flex justify-center opacity-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-400" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                mortly
              </span>
              <div className="h-px w-8 bg-amber-400" />
            </div>
          </div>

          {/* Card */}
          <div className="card-elevated opacity-0 animate-fade-in-up stagger-1">
            <div className="mb-8 text-center">
              <h1 className="heading-lg mb-2">{t("auth.loginTitle")}</h1>
              <p className="text-body-sm">
                {t("auth.loginSubtitle")}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="opacity-0 animate-fade-in-up stagger-2">
                <label htmlFor="email" className="label-text">
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <div className="opacity-0 animate-fade-in-up stagger-3">
                <label htmlFor="password" className="label-text">
                  {t("auth.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex justify-end opacity-0 animate-fade-in-up stagger-4">
                <Link
                  href="/forgot-password"
                  className="font-body text-sm text-forest-600 underline decoration-amber-400 decoration-2 underline-offset-2 transition-colors hover:text-forest-500"
                >
                  {t("auth.forgotPassword", "Forgot Password?")}
                </Link>
              </div>

              <div className="opacity-0 animate-fade-in-up stagger-5 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? t("auth.loggingIn") : t("auth.loginBtn")}
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-cream-300 pt-6 opacity-0 animate-fade-in-up stagger-6">
              <p className="text-center text-body-sm">
                {t("auth.noAccount")}{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-forest-700 underline decoration-amber-400 decoration-2 underline-offset-2 transition-colors hover:text-forest-600"
                >
                  {t("auth.signUpLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
