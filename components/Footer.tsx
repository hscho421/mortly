import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "next-i18next";

export default function Footer() {
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-cream-300 bg-forest-800">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block">
              <Image src="/logo/logo-footer.svg" alt="MortgageMatch" width={200} height={32} className="h-8 w-auto" />
            </Link>
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
