import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function ResetPasswordPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch", "Passwords do not match"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordTooShort", "Password must be at least 8 characters"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
                MortgageMatch
              </span>
              <div className="h-px w-8 bg-amber-400" />
            </div>
          </div>

          {/* Card */}
          <div className="card-elevated opacity-0 animate-fade-in-up stagger-1">
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="heading-lg mb-2">{t("auth.passwordReset", "Password Reset")}</h1>
                <p className="text-body-sm mb-6">
                  {t("auth.passwordResetSuccess", "Your password has been reset successfully. You can now log in with your new password.")}
                </p>
                <Link href="/login" className="btn-primary inline-block">
                  {t("auth.loginBtn", "Log In")}
                </Link>
              </div>
            ) : !token ? (
              <div className="text-center">
                <h1 className="heading-lg mb-2">{t("auth.invalidLink", "Invalid Link")}</h1>
                <p className="text-body-sm mb-6">
                  {t("auth.invalidLinkDesc", "This password reset link is invalid or has expired.")}
                </p>
                <Link href="/forgot-password" className="btn-primary inline-block">
                  {t("auth.requestNewLink", "Request New Link")}
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h1 className="heading-lg mb-2">{t("auth.resetPassword", "Reset Password")}</h1>
                  <p className="text-body-sm">
                    {t("auth.resetPasswordSubtitle", "Enter your new password below.")}
                  </p>
                </div>

                {error && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in">
                    <p className="font-body text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="opacity-0 animate-fade-in-up stagger-2">
                    <label htmlFor="password" className="label-text">
                      {t("auth.newPassword", "New Password")}
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field"
                      placeholder="At least 8 characters"
                    />
                  </div>

                  <div className="opacity-0 animate-fade-in-up stagger-3">
                    <label htmlFor="confirmPassword" className="label-text">
                      {t("auth.confirmNewPassword", "Confirm New Password")}
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Re-enter your password"
                    />
                  </div>

                  <div className="opacity-0 animate-fade-in-up stagger-4 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading
                        ? t("auth.resetting", "Resetting...")
                        : t("auth.resetPasswordBtn", "Reset Password")}
                    </button>
                  </div>
                </form>
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
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
