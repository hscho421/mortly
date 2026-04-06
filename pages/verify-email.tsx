import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function VerifyEmailPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const email = router.query.email as string | undefined;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split("");
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError(t("auth.invalidCode"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          setError(t("auth.codeExpired"));
        } else {
          setError(t("auth.invalidCode"));
        }
        setIsLoading(false);
        return;
      }

      router.push("/login?verified=true", undefined, { locale: router.locale });
    } catch {
      setError(t("auth.invalidCode"));
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale: router.locale }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setCountdown(data.retryAfter || 60);
        return;
      }

      setCountdown(60);
      setSuccess(t("auth.codeSent"));
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError(t("common.somethingWentWrong"));
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t("titles.verifyEmail")}</title>
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
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-50">
                <svg
                  className="h-7 w-7 text-forest-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h1 className="heading-lg mb-2">{t("auth.verifyEmailTitle")}</h1>
              <p className="text-body-sm">
                {t("auth.verifyEmailSubtitle", { email: email || "" })}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 animate-fade-in">
                <p className="font-body text-sm text-green-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="opacity-0 animate-fade-in-up stagger-2">
                <label className="label-text text-center block mb-3">
                  {t("auth.verificationCode")}
                </label>
                <div className="flex justify-center gap-2">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={index === 0 ? 6 : 1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="h-12 w-12 rounded-xl border-2 border-cream-300 bg-white text-center font-mono text-xl font-bold text-forest-800 transition-all duration-200 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
                    />
                  ))}
                </div>
              </div>

              <div className="opacity-0 animate-fade-in-up stagger-3">
                <button
                  type="submit"
                  disabled={isLoading || code.join("").length !== 6}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? t("auth.verifying") : t("auth.verifyBtn")}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center opacity-0 animate-fade-in-up stagger-4">
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                className="font-body text-sm text-forest-600 underline decoration-amber-400 decoration-2 underline-offset-2 transition-colors hover:text-forest-500 disabled:cursor-not-allowed disabled:text-sage-400 disabled:no-underline"
              >
                {countdown > 0
                  ? t("auth.resendCodeIn", { seconds: countdown })
                  : t("auth.resendCode")}
              </button>
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
