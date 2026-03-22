import { useState, useEffect, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

const ROLE_REDIRECTS: Record<string, string> = {
  BORROWER: "/borrower/request/new",
  BROKER: "/broker/dashboard",
};

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

  // Lock role from query param (e.g. /signup?role=borrower)
  const queryRole = (router.query.role as string)?.toUpperCase();
  const roleLocked = queryRole === "BORROWER" || queryRole === "BROKER";

  useEffect(() => {
    if (roleLocked) {
      setRole(queryRole as "BORROWER" | "BROKER");
    }
  }, [queryRole, roleLocked]);

  const validateForm = (): string | null => {
    if (!name.trim()) return "Name is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";

    if (password.length < 8)
      return "Password must be at least 8 characters long";

    if (password !== confirmPassword) return "Passwords do not match";

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
        setError(data.message || "Something went wrong");
        setIsLoading(false);
        return;
      }

      // Auto-login after successful signup
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account created but login failed - redirect to login
        router.push("/login", undefined, { locale: router.locale });
        return;
      }

      const redirectUrl = ROLE_REDIRECTS[role] || "/";
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
                  placeholder="John Doe"
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
                  placeholder="At least 8 characters"
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
                  placeholder="Re-enter your password"
                />
              </div>

              {!roleLocked && (
                <div className="opacity-0 animate-fade-in-up stagger-4">
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
              )}

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

            <div className="mt-8 border-t border-cream-300 pt-6 opacity-0 animate-fade-in-up stagger-6">
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
