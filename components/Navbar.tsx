import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "next-i18next";
import BrandMark from "./BrandMark";

interface Notice {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  // While next-auth is resolving the session (SSG homepages have no SSR
  // session, so first paint is always `loading`), hide auth-dependent chrome
  // entirely. Otherwise returning visitors see a ~100-500ms flash of the
  // logged-out Sign in / Get started CTAs before the navbar swaps to the
  // authed state.
  const authReady = status !== "loading";
  const router = useRouter();
  const { t } = useTranslation("common");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    const close = () => setMobileOpen(false);
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  // Fetch notices and unread messages for logged-in non-admin users
  const fetchNotices = useCallback(async () => {
    // Defensive: revoked sessions can produce { user: undefined }; treat as
    // anonymous so we don't crash on session.user.role.
    if (!session?.user || session.user.role === "ADMIN") return;
    try {
      const [noticesRes, unreadRes] = await Promise.all([
        fetch("/api/notices"),
        fetch("/api/messages/unread"),
      ]);
      if (noticesRes.ok) setNotices(await noticesRes.json());
      if (unreadRes.ok) {
        const data = await unreadRes.json();
        setUnreadMessages(data.unread);
      }
    } catch {
      // silent
    }
  }, [session]);

  useEffect(() => {
    fetchNotices();
    const interval = setInterval(fetchNotices, 30000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  // Refresh unread badge on custom event (from message pages) and route changes
  useEffect(() => {
    const handler = () => fetchNotices();
    window.addEventListener("refresh-unread", handler);
    router.events.on("routeChangeComplete", handler);
    return () => {
      window.removeEventListener("refresh-unread", handler);
      router.events.off("routeChangeComplete", handler);
    };
  }, [fetchNotices, router.events]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (noticeRef.current && !noticeRef.current.contains(e.target as Node)) {
        setNoticeOpen(false);
      }
    };
    if (noticeOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [noticeOpen]);

  const markAsRead = async (id: string) => {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch("/api/notices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // silent
    }
  };

  const unreadCount = notices.filter((n) => !n.read).length;

  const switchLocale = (locale: string) => {
    router.push(router.asPath, router.asPath, { locale });
  };

  const dashboardHref =
    session?.user?.role === "BROKER"
      ? "/broker/dashboard"
      : session?.user?.role === "ADMIN"
        ? "/admin/inbox"
        : "/borrower/dashboard";

  const profileHref =
    session?.user?.role === "BROKER" ? "/broker/profile" : "/borrower/profile";

  const messagesHref =
    session?.user?.role === "BROKER" ? "/broker/messages" : "/borrower/messages";

  const role = session?.user?.role;
  const showUserLinks = role === "BORROWER" || role === "BROKER";

  const navLinks = session
    ? [
        { href: dashboardHref, label: t("nav.dashboard") },
        ...(showUserLinks ? [{ href: messagesHref, label: role === "BROKER" ? t("broker.messages") : t("nav.messages"), badge: unreadMessages }] : []),
        ...(role === "BROKER" ? [{ href: "/pricing", label: t("nav.pricing") }] : []),
      ]
    : [];

  const isActive = (href: string) => router.pathname === href;
  const isMessagesActive = isActive("/borrower/messages") || isActive("/broker/messages");
  const isProfileActive = isActive("/borrower/profile") || isActive("/broker/profile");

  return (
    <>
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? "bg-cream-100/90 backdrop-blur-xl border-cream-300"
          : "bg-cream-100 border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo — canonical mark, edit /public/logo/logo.svg to change */}
          <BrandMark href="/" className="h-7 w-auto" />

          {/* Desktop center links — editorial: flat text links with amber underline for active */}
          {navLinks.length > 0 && (
            <div className="hidden items-center gap-6 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 font-body text-[13px] transition-colors duration-200 ${
                    isActive(link.href) || (link.href === messagesHref && isMessagesActive)
                      ? "text-forest-800 font-medium"
                      : "text-forest-600/70 hover:text-forest-800"
                  }`}
                >
                  {(isActive(link.href) || (link.href === messagesHref && isMessagesActive)) && (
                    <span className="absolute -bottom-[21px] left-0 right-0 h-[2px] bg-amber-500" />
                  )}
                  {link.label}
                  {"badge" in link && (link as { badge?: number }).badge ? (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
                      {(link as { badge: number }).badge > 9 ? "9+" : (link as { badge: number }).badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}

          {/* Desktop right section */}
          <div className="hidden items-center gap-1 md:flex">
            {/* Language switcher — mono KO · EN toggle */}
            <div className="flex items-center gap-2 mr-3 font-mono text-[11px] tracking-[0.12em]">
              <button
                onClick={() => switchLocale("ko")}
                className={`transition-colors duration-200 ${
                  router.locale === "ko"
                    ? "text-forest-800 font-semibold"
                    : "text-sage-400 hover:text-forest-700"
                }`}
              >
                KO
              </button>
              <span className="text-sage-300">·</span>
              <button
                onClick={() => switchLocale("en")}
                className={`transition-colors duration-200 ${
                  router.locale === "en"
                    ? "text-forest-800 font-semibold"
                    : "text-sage-400 hover:text-forest-700"
                }`}
              >
                EN
              </button>
            </div>

            {!authReady ? (
              // Reserved space matching the authed/unauthed slot height so the
              // navbar doesn't shift when session resolves. ~32px tall matches
              // the icon buttons / sign-in pair on the right side.
              <div aria-hidden className="h-8" />
            ) : session ? (
              <div className="flex items-center gap-1">
                {/* Notification bell */}
                {showUserLinks && (
                  <div className="relative" ref={noticeRef}>
                    <button
                      onClick={() => setNoticeOpen(!noticeOpen)}
                      className={`group relative rounded-sm p-2 transition-all duration-200 ${
                        noticeOpen
                          ? "bg-cream-200 text-forest-800"
                          : "text-forest-500 hover:bg-cream-200 hover:text-forest-700"
                      }`}
                      title={t("nav.notifications", "Notifications")}
                      aria-label={t("nav.notifications", "Notifications")}
                    >
                      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Dropdown */}
                    {noticeOpen && (
                      <div
                        role="menu"
                        aria-label={t("nav.notifications", "Notifications")}
                        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Escape") setNoticeOpen(false); }}
                        className="absolute right-0 top-full mt-2 w-80 rounded-sm bg-cream-50 shadow-xl ring-1 ring-cream-300 animate-fade-in overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-cream-200">
                          <p className="font-body text-sm font-semibold text-forest-800">
                            {t("nav.notifications", "Notifications")}
                          </p>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notices.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                              <p className="font-body text-sm text-forest-700/50">
                                {t("nav.noNotifications", "No notifications")}
                              </p>
                            </div>
                          ) : (
                            notices.map((notice) => (
                              <button
                                key={notice.id}
                                onClick={() => markAsRead(notice.id)}
                                className={`w-full text-left px-4 py-3 border-b border-cream-100 transition-colors hover:bg-cream-50 ${
                                  !notice.read ? "bg-forest-50/30" : ""
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {!notice.read && (
                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest-500" />
                                  )}
                                  <div className={!notice.read ? "" : "pl-4"}>
                                    <p className={`font-body text-sm ${!notice.read ? "font-semibold text-forest-800" : "text-forest-700"}`}>
                                      {notice.subject}
                                    </p>
                                    <p className="font-body text-xs text-forest-700/60 mt-0.5 line-clamp-2">
                                      {notice.body}
                                    </p>
                                    <p className="font-body text-[10px] text-forest-700/40 mt-1">
                                      {new Date(notice.createdAt).toLocaleDateString(
                                        router.locale === "ko" ? "ko-KR" : "en-CA",
                                        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Link
                  href={profileHref}
                  className={`group relative rounded-sm p-2 transition-all duration-200 ${
                    isProfileActive
                      ? "bg-cream-200 text-forest-800"
                      : "text-forest-500 hover:bg-cream-200 hover:text-forest-700"
                  }`}
                  title={t("nav.settings", "Settings")}
                  aria-label={t("nav.settings", "Settings")}
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </Link>

                <div className="mx-1 h-5 w-px bg-cream-300" />

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="rounded-sm p-2 text-forest-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
                  title={t("nav.signOut")}
                  aria-label={t("nav.signOut")}
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="font-body text-[13px] font-medium text-forest-700 transition-colors duration-200 hover:text-forest-900"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-sm bg-amber-500 px-4 py-2 font-body text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-amber-600"
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
            aria-controls="mobile-menu"
            aria-label={t("misc.toggleNav")}
          >
            <div className="relative w-5 h-4 flex flex-col justify-between">
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center ${mobileOpen ? "rotate-45 translate-y-[7.25px]" : ""}`} />
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 ${mobileOpen ? "opacity-0 scale-x-0" : ""}`} />
              <span className={`block h-[1.5px] w-full bg-current rounded-full transition-all duration-300 origin-center ${mobileOpen ? "-rotate-45 -translate-y-[7.25px]" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-cream-300 bg-cream-100 px-4 pb-5 pt-3">
          <div className="space-y-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center rounded-sm px-3 py-2.5 font-body text-[13px] transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-cream-200 text-forest-800 font-medium border-l-2 border-amber-500"
                    : "text-forest-600/70 hover:bg-cream-200 hover:text-forest-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="my-3 h-px bg-cream-200" />

          {/* Mobile language switcher */}
          <div className="flex items-center gap-3 px-3 py-1.5">
            <span className="mono-label">{t("misc.language")}</span>
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em]">
              <button
                onClick={() => { switchLocale("ko"); setMobileOpen(false); }}
                className={`transition-colors duration-200 ${
                  router.locale === "ko" ? "text-forest-800 font-semibold" : "text-sage-400"
                }`}
              >
                KO
              </button>
              <span className="text-sage-300">·</span>
              <button
                onClick={() => { switchLocale("en"); setMobileOpen(false); }}
                className={`transition-colors duration-200 ${
                  router.locale === "en" ? "text-forest-800 font-semibold" : "text-sage-400"
                }`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="my-3 h-px bg-cream-200" />

          {!authReady ? null : session ? (
            <div className="space-y-0.5">
              <Link
                href={dashboardHref}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                  isActive(dashboardHref)
                    ? "bg-cream-200 text-forest-800 border-l-2 border-amber-500"
                    : "text-forest-600/70 hover:bg-cream-200 hover:text-forest-800"
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
                  className={`flex items-center gap-3 rounded-sm px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                    isMessagesActive
                      ? "bg-cream-200 text-forest-800 border-l-2 border-amber-500"
                      : "text-forest-600/70 hover:bg-cream-200 hover:text-forest-800"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                  {role === "BROKER" ? t("broker.messages") : t("nav.messages")}
                  {unreadMessages > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-sm bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
              )}

              {/* Mobile notifications */}
              {showUserLinks && (
                <button
                  onClick={() => { setMobileOpen(false); setNoticeOpen(!noticeOpen); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[13px] font-medium text-forest-600/70 transition-all duration-200 hover:bg-cream-200 hover:text-forest-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                  {t("nav.notifications", "Notifications")}
                  {unreadCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-sm bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              )}

              <Link
                href={profileHref}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 font-body text-[13px] font-medium transition-all duration-200 ${
                  isProfileActive
                    ? "bg-cream-200 text-forest-800 border-l-2 border-amber-500"
                    : "text-forest-600/70 hover:bg-cream-200 hover:text-forest-800"
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
                  setShowLogoutConfirm(true);
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
                className="block rounded-sm px-3 py-2.5 text-center font-body text-[13px] font-medium text-forest-700 transition-all hover:bg-cream-200"
              >
                {t("nav.signIn")}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="block rounded-sm bg-amber-500 px-3 py-2.5 text-center font-body text-[13px] font-semibold text-white transition-all hover:bg-amber-600"
              >
                {t("nav.getStarted")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>

    {/* Logout confirmation modal */}
    {showLogoutConfirm && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={() => setShowLogoutConfirm(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-sm bg-cream-50 border border-cream-300 p-6 shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="heading-sm mb-2">{t("nav.logoutConfirmTitle")}</h3>
        <p className="text-body-sm text-sage-500 mb-6">{t("nav.logoutConfirmDesc")}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLogoutConfirm(false)}
            className="flex-1 rounded-sm border border-cream-300 px-4 py-2.5 font-body text-sm font-medium text-forest-700 transition-all duration-200 hover:bg-cream-200"
          >
            {t("nav.logoutCancel")}
          </button>
          <button
            onClick={async () => {
              setShowLogoutConfirm(false);
              // Redirect to /login (not /). The homepage renders this same
              // Navbar, which reads useSession(); the client session cache
              // can briefly return the stale pre-logout session before the
              // post-signOut refetch lands, painting authed nav links for
              // ~100-500ms. /login has no session-dependent chrome, so the
              // transition is clean.
              await signOut({ callbackUrl: "/login" });
            }}
            className="flex-1 rounded-sm bg-red-500 px-4 py-2.5 font-body text-sm font-medium text-white transition-all duration-200 hover:bg-red-600"
          >
            {t("nav.logoutConfirm")}
          </button>
        </div>
      </div>
    </div>
    )}
    </>
  );
}
