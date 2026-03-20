import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "next-i18next";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const switchLocale = (locale: string) => {
    router.push(router.asPath, router.asPath, { locale });
  };

  const dashboardHref =
    session?.user?.role === "BROKER"
      ? "/broker/dashboard"
      : session?.user?.role === "ADMIN"
        ? "/admin/dashboard"
        : "/borrower/dashboard";

  const profileHref =
    session?.user?.role === "BROKER" ? "/broker/profile" : "/borrower/profile";

  const messagesHref =
    session?.user?.role === "BROKER" ? "/broker/messages" : "/borrower/messages";

  const publicLinks = [
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/brokers", label: t("nav.brokers") },
    { href: "/for-brokers", label: t("nav.forBrokers") },
    { href: "/pricing", label: t("nav.pricing") },
  ];

  const isActive = (href: string) => router.pathname === href;
  const isMessagesActive = isActive("/borrower/messages") || isActive("/broker/messages");
  const isProfileActive = isActive("/borrower/profile") || isActive("/broker/profile");
  const showUserLinks = session?.user?.role === "BORROWER" || session?.user?.role === "BROKER";

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-cream-100/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
          : "bg-cream-100"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-forest-800 transition-all duration-300 group-hover:rounded-lg group-hover:shadow-md group-hover:shadow-forest-800/25">
              <svg className="h-4 w-4 text-amber-400 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo-text.svg" alt="MortgageMatch" className="h-6" />
          </Link>

          {/* Desktop center links */}
          <div className="hidden items-center md:flex">
            <div className="flex items-center rounded-full bg-cream-300/50 px-1 py-1">
              {publicLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-full px-3.5 py-1.5 font-body text-[13px] font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? "bg-white text-forest-800 shadow-sm"
                      : "text-forest-600/70 hover:text-forest-800"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop right section */}
          <div className="hidden items-center gap-1 md:flex">
            {/* Language switcher */}
            <div className="flex items-center rounded-full bg-cream-300/50 p-0.5 mr-2">
              <button
                onClick={() => switchLocale("en")}
                className={`rounded-full px-2 py-1 font-body text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                  router.locale === "en"
                    ? "bg-forest-800 text-cream-100 shadow-sm"
                    : "text-forest-500 hover:text-forest-700"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => switchLocale("ko")}
                className={`rounded-full px-2 py-1 font-body text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                  router.locale === "ko"
                    ? "bg-forest-800 text-cream-100 shadow-sm"
                    : "text-forest-500 hover:text-forest-700"
                }`}
              >
                KO
              </button>
            </div>

            {session ? (
              <div className="flex items-center gap-1">
                {/* Icon nav for authenticated users */}
                <Link
                  href={dashboardHref}
                  className={`group relative rounded-lg p-2 transition-all duration-200 ${
                    isActive(dashboardHref)
                      ? "bg-forest-100 text-forest-800"
                      : "text-forest-500 hover:bg-cream-200 hover:text-forest-700"
                  }`}
                  title={t("nav.dashboard")}
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                </Link>

                {showUserLinks && (
                  <Link
                    href={messagesHref}
                    className={`group relative rounded-lg p-2 transition-all duration-200 ${
                      isMessagesActive
                        ? "bg-forest-100 text-forest-800"
                        : "text-forest-500 hover:bg-cream-200 hover:text-forest-700"
                    }`}
                    title={t("nav.messages")}
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </Link>
                )}

                <Link
                  href={profileHref}
                  className={`group relative rounded-lg p-2 transition-all duration-200 ${
                    isProfileActive
                      ? "bg-forest-100 text-forest-800"
                      : "text-forest-500 hover:bg-cream-200 hover:text-forest-700"
                  }`}
                  title={t("nav.settings", "Settings")}
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </Link>

                <div className="mx-1 h-5 w-px bg-cream-300" />

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-lg p-2 text-forest-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
                  title={t("nav.signOut")}
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-3.5 py-2 font-body text-[13px] font-medium text-forest-600 transition-all duration-200 hover:bg-cream-200 hover:text-forest-800"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-forest-800 px-4 py-2 font-body text-[13px] font-semibold text-cream-100 transition-all duration-300 hover:bg-forest-700 hover:shadow-md hover:shadow-forest-800/20 active:scale-[0.97]"
                >
                  {t("nav.getStarted")}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-forest-600 transition-colors hover:bg-cream-200 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            <div className="relative w-5 h-4 flex flex-col justify-between">
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center ${mobileOpen ? "rotate-45 translate-y-[5px]" : ""}`} />
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 ${mobileOpen ? "opacity-0 scale-x-0" : ""}`} />
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center ${mobileOpen ? "-rotate-45 -translate-y-[5px]" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-cream-200 bg-cream-50/80 backdrop-blur-xl px-4 pb-5 pt-3">
          <div className="space-y-0.5">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-white text-forest-800 shadow-sm"
                    : "text-forest-600/70 hover:bg-white/60 hover:text-forest-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="my-3 h-px bg-cream-200" />

          {/* Mobile language switcher */}
          <div className="flex items-center gap-1 px-3 py-1.5">
            <span className="text-[11px] font-body text-forest-500/60 font-medium tracking-wide uppercase mr-2">Lang</span>
            <div className="flex items-center rounded-full bg-cream-200/80 p-0.5">
              <button
                onClick={() => { switchLocale("en"); setMobileOpen(false); }}
                className={`rounded-full px-2.5 py-1 font-body text-[11px] font-semibold transition-all duration-200 ${
                  router.locale === "en" ? "bg-forest-800 text-cream-100 shadow-sm" : "text-forest-500"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => { switchLocale("ko"); setMobileOpen(false); }}
                className={`rounded-full px-2.5 py-1 font-body text-[11px] font-semibold transition-all duration-200 ${
                  router.locale === "ko" ? "bg-forest-800 text-cream-100 shadow-sm" : "text-forest-500"
                }`}
              >
                KO
              </button>
            </div>
          </div>

          <div className="my-3 h-px bg-cream-200" />

          {session ? (
            <div className="space-y-0.5">
              <Link
                href={dashboardHref}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                  isActive(dashboardHref)
                    ? "bg-white text-forest-800 shadow-sm"
                    : "text-forest-600/70 hover:bg-white/60 hover:text-forest-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
                {t("nav.dashboard")}
              </Link>

              {showUserLinks && (
                <Link
                  href={messagesHref}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                    isMessagesActive
                      ? "bg-white text-forest-800 shadow-sm"
                      : "text-forest-600/70 hover:bg-white/60 hover:text-forest-800"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                  {t("nav.messages")}
                </Link>
              )}

              <Link
                href={profileHref}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                  isProfileActive
                    ? "bg-white text-forest-800 shadow-sm"
                    : "text-forest-600/70 hover:bg-white/60 hover:text-forest-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                {t("nav.settings", "Settings")}
              </Link>

              <div className="my-2 h-px bg-cream-200" />

              <button
                onClick={() => {
                  setMobileOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[13px] font-medium text-red-500/80 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <div className="space-y-2 px-1">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-center font-body text-[13px] font-medium text-forest-600/70 transition-all hover:bg-white/60 hover:text-forest-800"
              >
                {t("nav.login")}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg bg-forest-800 px-4 py-2.5 text-center font-body text-[13px] font-semibold text-cream-100 transition-all hover:bg-forest-700"
              >
                {t("nav.getStarted")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
