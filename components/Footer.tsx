import React from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";

export default function Footer() {
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-cream-300 bg-forest-800">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-display text-lg text-cream-100">
                MortgageMatch
              </span>
            </div>
            <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-cream-400/70">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-body text-xs font-semibold uppercase tracking-widest text-cream-400/50">
              {t("footer.platform")}
            </h4>
            <nav className="mt-4 flex flex-col gap-3">
              <Link href="/how-it-works" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("nav.howItWorks")}
              </Link>
              <Link href="/for-brokers" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("nav.forBrokers")}
              </Link>
              <Link href="/pricing" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("nav.pricing")}
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-body text-xs font-semibold uppercase tracking-widest text-cream-400/50">
              {t("footer.legal")}
            </h4>
            <nav className="mt-4 flex flex-col gap-3">
              <Link href="/privacy" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("footer.privacyTrust")}
              </Link>
              <Link href="/terms" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("footer.terms")}
              </Link>
              <Link href="/contact" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("footer.contact")}
              </Link>
            </nav>
          </div>

          {/* Get started */}
          <div>
            <h4 className="font-body text-xs font-semibold uppercase tracking-widest text-cream-400/50">
              {t("footer.getStarted")}
            </h4>
            <nav className="mt-4 flex flex-col gap-3">
              <Link href="/signup" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("footer.createAccount")}
              </Link>
              <Link href="/login" className="font-body text-sm text-cream-300/80 transition-colors hover:text-amber-400">
                {t("footer.signIn")}
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-14 border-t border-cream-100/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-body text-xs text-cream-400/50">
              &copy; {new Date().getFullYear()} {t("footer.copyright")}
            </p>
            <p className="max-w-md text-center font-body text-xs text-cream-400/40 sm:text-right">
              {t("footer.disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
