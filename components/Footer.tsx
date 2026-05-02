import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import BrandMark from "./BrandMark";

export default function Footer() {
  const { data: session } = useSession();
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-cream-300 bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <BrandMark href="/" className="h-9 w-auto" />
            <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-forest-700/70 whitespace-pre-line">
              {t("footer.tagline")}
            </p>
            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-sage-500">
              <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">KO</span>
              <span className="rounded-sm border border-cream-300 bg-cream-100 px-2 py-0.5">EN</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="mono-label mb-4">
              {t("footer.platform")}
            </h4>
            <nav className="flex flex-col gap-3">
              <Link href="/how-it-works" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("nav.howItWorks")}
              </Link>
              <Link href="/for-borrowers" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("nav.forBorrowers")}
              </Link>
              <Link href="/for-brokers" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("nav.forBrokers")}
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mono-label mb-4">
              {t("footer.legal")}
            </h4>
            <nav className="flex flex-col gap-3">
              <Link href="/privacy" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("footer.privacyTrust")}
              </Link>
              <Link href="/terms" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("footer.terms")}
              </Link>
              <Link href="/contact" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                {t("footer.contact")}
              </Link>
            </nav>
          </div>

          {/* Get started / Dashboard */}
          <div>
            {session?.user ? (
              <>
                <h4 className="mono-label mb-4">
                  {t("nav.dashboard")}
                </h4>
                <nav className="flex flex-col gap-3">
                  <Link
                    href={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (session.user as any).role === "ADMIN"
                        ? "/admin"
                        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (session.user as any).role === "BROKER"
                          ? "/broker/dashboard"
                          : "/borrower/dashboard"
                    }
                    className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600"
                  >
                    {t("nav.dashboard")}
                  </Link>
                </nav>
              </>
            ) : (
              <>
                <h4 className="mono-label mb-4">
                  {t("footer.getStarted")}
                </h4>
                <nav className="flex flex-col gap-3">
                  <Link href="/signup" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                    {t("footer.createAccount")}
                  </Link>
                  <Link href="/login" className="font-body text-sm text-forest-700/80 transition-colors hover:text-amber-600">
                    {t("footer.signIn")}
                  </Link>
                </nav>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-cream-300 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-mono text-[11px] tracking-[0.12em] text-sage-500">
              &copy; {new Date().getFullYear()} {t("footer.copyright")}
            </p>
            <p className="max-w-xl text-center font-body text-xs text-forest-700/60 sm:text-right">
              {t("footer.disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
