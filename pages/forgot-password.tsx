import { useState, FormEvent } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function ForgotPasswordPage() {
  const { t } = useTranslation("common");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("common.somethingWentWrong"));
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
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
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="heading-lg mb-2">{t("auth.checkEmail", "Check Your Email")}</h1>
                <p className="text-body-sm mb-6">
                  {t("auth.resetLinkSent", "If an account with that email exists, we've sent a password reset link. Please check your inbox.")}
                </p>
                <Link href="/login" className="btn-primary inline-block">
                  {t("auth.backToLogin", "Back to Login")}
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h1 className="heading-lg mb-2">{t("auth.forgotPassword", "Forgot Password")}</h1>
                  <p className="text-body-sm">
                    {t("auth.forgotPasswordSubtitle", "Enter your email and we'll send you a link to reset your password.")}
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
                      placeholder={t("misc.placeholderEmail")}
                    />
                  </div>

                  <div className="opacity-0 animate-fade-in-up stagger-3 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading
                        ? t("auth.sending", "Sending...")
                        : t("auth.sendResetLink", "Send Reset Link")}
                    </button>
                  </div>
                </form>

                <div className="mt-8 border-t border-cream-300 pt-6 opacity-0 animate-fade-in-up stagger-4">
                  <p className="text-center text-body-sm">
                    {t("auth.rememberPassword", "Remember your password?")}{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-forest-700 underline decoration-amber-400 decoration-2 underline-offset-2 transition-colors hover:text-forest-600"
                    >
                      {t("auth.loginLink", "Log in")}
                    </Link>
                  </p>
                </div>
              </>
            )}
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
