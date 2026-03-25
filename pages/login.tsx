import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

const ROLE_REDIRECTS: Record<string, string> = {
  BORROWER: "/borrower/dashboard",
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
  const verified = router.query.verified === "true";

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
        if (result.error === "EMAIL_NOT_VERIFIED") {
          router.push(
            `/verify-email?email=${encodeURIComponent(email)}`,
            undefined,
            { locale: router.locale }
          );
          return;
        }
        if (result.error === "GOOGLE_ACCOUNT") {
          setError(t("auth.useGoogleSignIn"));
          setIsLoading(false);
          return;
        }
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
      setError(t("common.unexpectedError"));
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

            {verified && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-green-700">{t("auth.emailVerified")}</p>
              </div>
            )}

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
                  placeholder={t("auth.placeholderEmail")}
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
                  placeholder={t("auth.placeholderPassword")}
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

            {/* Divider */}
            <div className="flex items-center gap-3 my-6 opacity-0 animate-fade-in-up stagger-6">
              <div className="h-px flex-1 bg-cream-300" />
              <span className="font-body text-xs text-sage-500">{t("auth.orContinueWith")}</span>
              <div className="h-px flex-1 bg-cream-300" />
            </div>

            {/* Google sign-in */}
            <div className="opacity-0 animate-fade-in-up stagger-7">
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/select-role" })}
                className="btn-secondary w-full flex items-center justify-center gap-2.5"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {t("auth.continueWithGoogle")}
              </button>
            </div>

            <div className="mt-8 border-t border-cream-300 pt-6 opacity-0 animate-fade-in-up stagger-8">
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
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
