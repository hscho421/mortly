import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import posthog from "posthog-js";

export default function SignupPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"BORROWER" | "BROKER">("BORROWER");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Lock role from query param (e.g. /signup?role=borrower)
  const queryRole = (router.query.role as string)?.toUpperCase();
  const roleLocked = queryRole === "BORROWER" || queryRole === "BROKER";

  useEffect(() => {
    if (roleLocked) {
      setRole(queryRole as "BORROWER" | "BROKER");
    }
  }, [queryRole, roleLocked]);

  const validateForm = (): string | null => {
    if (!name.trim()) return t("auth.nameRequired");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return t("auth.invalidEmail");

    if (password.length < 8)
      return t("auth.passwordTooShort");

    if (password !== confirmPassword) return t("auth.passwordMismatch");

    if (!agreedToTerms) return t("auth.mustAgreeToTerms");

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || t("common.somethingWentWrong"));
        setIsLoading(false);
        return;
      }

      posthog.identify(email, { name, email, role });
      posthog.capture("user_signed_up", { role });

      // Redirect to email verification page
      router.push(
        `/verify-email?email=${encodeURIComponent(email)}`,
        undefined,
        { locale: router.locale }
      );
    } catch (err) {
      posthog.captureException(err);
      setError(t("common.unexpectedError"));
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t("titles.signup")}</title>
      </Head>
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
              <h1 className="heading-lg mb-2">
                {roleLocked && role === "BORROWER"
                  ? t("auth.signupBorrowerTitle")
                  : roleLocked && role === "BROKER"
                    ? t("auth.signupBrokerTitle")
                    : t("auth.signupTitle")}
              </h1>
              <p className="text-body-sm">
                {roleLocked && role === "BORROWER"
                  ? t("auth.signupBorrowerSubtitle")
                  : roleLocked && role === "BROKER"
                    ? t("auth.signupBrokerSubtitle")
                    : t("auth.signupSubtitle")}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="opacity-0 animate-fade-in-up stagger-2">
                <label htmlFor="name" className="label-text">
                  {t("auth.name")}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder={t("auth.placeholderName")}
                />
              </div>

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

              <div className="opacity-0 animate-fade-in-up stagger-3">
                <label htmlFor="confirmPassword" className="label-text">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder={t("auth.placeholderConfirmPassword")}
                />
              </div>

              {!roleLocked && (
                <div className="opacity-0 animate-fade-in-up stagger-4">
                  <p className="font-body text-sm font-medium text-forest-800 mb-3">{t("auth.role")}</p>
                  <div className="space-y-3">
                    <label
                      onClick={() => setRole("BORROWER")}
                      className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all duration-200 ${
                        role === "BORROWER"
                          ? "border-forest-700 bg-forest-50 shadow-sm"
                          : "border-cream-300 bg-white hover:border-sage-300 hover:bg-cream-50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        role === "BORROWER"
                          ? "border-forest-700 bg-forest-700"
                          : "border-cream-400"
                      }`}>
                        {role === "BORROWER" && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                      <span className="font-body text-sm text-forest-800 leading-snug">{t("auth.borrower")}</span>
                    </label>
                    <label
                      onClick={() => setRole("BROKER")}
                      className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all duration-200 ${
                        role === "BROKER"
                          ? "border-forest-700 bg-forest-50 shadow-sm"
                          : "border-cream-300 bg-white hover:border-sage-300 hover:bg-cream-50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        role === "BROKER"
                          ? "border-forest-700 bg-forest-700"
                          : "border-cream-400"
                      }`}>
                        {role === "BROKER" && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                      <span className="font-body text-sm text-forest-800 leading-snug">{t("auth.broker")}</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="opacity-0 animate-fade-in-up stagger-5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-cream-400 text-forest-700 focus:ring-forest-500 cursor-pointer"
                  />
                  <span className="font-body text-xs text-forest-700/70 leading-relaxed">
                    {t("auth.agreeToTermsPrefix")}{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors">
                      {t("auth.termsOfService")}
                    </Link>
                    {" "}{t("auth.and")}{" "}
                    <Link href="/privacy" target="_blank" className="font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors">
                      {t("auth.privacyPolicy")}
                    </Link>
                    {t("auth.agreeToTermsSuffix")}
                  </span>
                </label>
              </div>

              <div className="opacity-0 animate-fade-in-up stagger-5 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? t("auth.creatingAccount") : t("auth.signupBtn")}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6 opacity-0 animate-fade-in-up stagger-6">
              <div className="h-px flex-1 bg-cream-300" />
              <span className="font-body text-xs text-sage-500">{t("auth.orContinueWith")}</span>
              <div className="h-px flex-1 bg-cream-300" />
            </div>

            {/* Google sign-up */}
            <div className="opacity-0 animate-fade-in-up stagger-7">
              <button
                type="button"
                onClick={() => {
                  if (!agreedToTerms) {
                    setError(t("auth.mustAgreeToTerms"));
                    return;
                  }
                  signIn("google", {
                    callbackUrl: roleLocked
                      ? `/select-role?role=${role.toLowerCase()}`
                      : "/select-role",
                  });
                }}
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
                {t("auth.haveAccount")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-forest-700 underline decoration-amber-400 decoration-2 underline-offset-2 transition-colors hover:text-forest-600"
                >
                  {t("auth.signInLink")}
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
