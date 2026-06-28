import React, { ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import BrandMark from "@/components/BrandMark";
import MobileTabBar from "@/components/MobileTabBar";
import { useBorrowerData } from "./BorrowerDataContext";

/**
 * BorrowerShell — unified borrower-app chrome.
 *
 * Same pattern as BrokerShell. Owns:
 *   • Auth gate (redirects non-borrower viewers to /login).
 *   • Persistent 240px sidebar; mobile slide-over drawer.
 *   • Sign-out confirmation modal that lands on /login (avoids the marketing
 *     homepage flicker — same fix applied on the broker side).
 *
 * Pages render inside this shell via `<BorrowerShell active="dashboard">…`.
 */

export type BorrowerNavKey = "dashboard" | "messages" | "profile";

interface NavItem {
  key: BorrowerNavKey;
  href: string;
  labelKey: string;
  fallback: string;
  glyph: string;
  badge?: "activeRequests" | "unreadMessages";
}

// Sidebar items intentionally minimal: the dashboard already lists requests,
// so a separate "내 요청" item would point to the same route. Phase 2 may
// revisit if the dashboard evolves into a pure overview page.
const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/borrower/dashboard",
    labelKey: "borrower.nav.dashboard",
    fallback: "대시보드",
    glyph: "◈",
    badge: "activeRequests",
  },
  {
    key: "messages",
    href: "/borrower/messages",
    labelKey: "borrower.nav.messages",
    fallback: "메시지",
    glyph: "✉",
    badge: "unreadMessages",
  },
  {
    key: "profile",
    href: "/borrower/profile",
    labelKey: "borrower.nav.profile",
    fallback: "프로필",
    glyph: "❋",
  },
];

// All three borrower destinations are primary tabs; "More" holds only sign-out.
const MOBILE_PRIMARY: BorrowerNavKey[] = ["dashboard", "messages", "profile"];

export interface BorrowerShellProps {
  active: BorrowerNavKey;
  pageTitle?: string;
  children: ReactNode;
  /** Hide the mobile bottom tab bar (e.g. the chat detail view owns the bottom). */
  hideMobileTabBar?: boolean;
}

export default function BorrowerShell({
  active,
  pageTitle,
  children,
  hideMobileTabBar = false,
}: BorrowerShellProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation("common");
  const { profile, counters } = useBorrowerData();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  // Auth gate. callbackUrl brings the visitor back here after login — the
  // marketing CTAs deep-link into authed pages (e.g. /borrower/request/new).
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BORROWER") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(router.asPath)}`,
        undefined,
        { locale: router.locale },
      );
    }
  }, [session, status, router]);

  const loadingAuth =
    status === "loading" || !session || session.user.role !== "BORROWER";

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 text-forest-800">
        <Head>
          <title>{pageTitle ?? "mortly"}</title>
        </Head>
        <p className="font-body text-sm text-sage-500">
          {t("common.loading", "Loading…")}
        </p>
      </div>
    );
  }

  const borrowerName =
    profile?.name ||
    session.user.name ||
    (session.user.email ? session.user.email.split("@")[0] : "Borrower");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-cream-100 text-forest-800">
      <Head>
        <title>{pageTitle ?? "mortly"}</title>
      </Head>

      <a href="#main-content" className="skip-link">
        {t("misc.skipToContent", "Skip to content")}
      </a>

      <Sidebar
        active={active}
        counters={counters}
        borrowerName={borrowerName}
        location={profile?.publicId ? `#${profile.publicId.slice(0, 6)}` : null}
        className="hidden md:flex"
      />

      <div className="flex flex-1 flex-col min-w-0">
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom tab bar — replaces the slide-over drawer below md.
            Hidden on the chat detail view so the composer owns the bottom edge. */}
        {!hideMobileTabBar && (
        <MobileTabBar
          active={active}
          tabs={NAV_ITEMS.filter((it) => MOBILE_PRIMARY.includes(it.key)).map((it) => ({
            key: it.key,
            href: it.href,
            label: t(it.labelKey, it.fallback),
            glyph: it.glyph,
            badge:
              it.badge === "activeRequests"
                ? counters.activeRequests
                : it.badge === "unreadMessages"
                  ? counters.unreadMessages
                  : undefined,
          }))}
          moreItems={NAV_ITEMS.filter((it) => !MOBILE_PRIMARY.includes(it.key)).map((it) => ({
            key: it.key,
            href: it.href,
            label: t(it.labelKey, it.fallback),
            glyph: it.glyph,
          }))}
          moreLabel={t("nav.more", "More")}
          closeLabel={t("common.close", "Close")}
          accountName={borrowerName}
          accountSubtitle={profile?.publicId ? `#${profile.publicId.slice(0, 6)}` : null}
          signOutLabel={t("nav.signOut", "Sign Out")}
          onSignOut={() => setSignOutOpen(true)}
        />
        )}
      </div>

      {signOutOpen && (
        <SignOutConfirmModal
          onCancel={() => setSignOutOpen(false)}
          onConfirm={async () => {
            setSignOutOpen(false);
            await handleSignOut();
          }}
          busy={signingOut}
          t={t}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────
function Sidebar({
  active,
  counters,
  borrowerName,
  location,
  className = "",
}: {
  active: BorrowerNavKey;
  counters: {
    activeRequests: number;
    unreadMessages: number;
    activeConversations: number;
    totalResponses: number;
  };
  borrowerName: string;
  location: string | null;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Land on /login (not /) — same flicker fix as the broker side. The public
  // homepage's Navbar reads useSession() and the client-side cache can paint
  // the prior authed nav for ~100-500ms before the post-signout refetch
  // resolves. /login has no session-dependent chrome.
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <aside
      className={`flex h-full w-[240px] shrink-0 flex-col border-r border-cream-300 bg-cream-50 ${className}`}
    >
      <div className="flex items-baseline justify-between border-b border-cream-300 px-5 py-4">
        <BrandMark href="/borrower/dashboard" className="h-7 w-auto" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sage-500">
          {t("borrower.tagline", "신청인")}
        </span>
      </div>

      <nav
        className="flex-1 overflow-y-auto p-2"
        aria-label="Borrower navigation"
      >
        {NAV_ITEMS.map((it) => {
          const on = active === it.key;
          const badgeValue =
            it.badge === "activeRequests"
              ? counters.activeRequests
              : it.badge === "unreadMessages"
                ? counters.unreadMessages
                : 0;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] transition-colors ${
                on
                  ? "bg-amber-50 text-forest-800 font-semibold border-l-2 border-amber-500 pl-[10px]"
                  : "text-forest-700/80 hover:bg-cream-200 hover:text-forest-800 border-l-2 border-transparent pl-[10px]"
              }`}
            >
              <span
                className={`w-5 font-mono text-[13px] ${
                  on ? "text-amber-600" : "text-sage-400"
                }`}
                aria-hidden
              >
                {it.glyph}
              </span>
              <span className="flex-1">{t(it.labelKey, it.fallback)}</span>
              {it.badge && badgeValue > 0 && (
                <span className="ml-2 inline-flex h-4 min-w-[20px] items-center justify-center rounded-sm bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
                  {badgeValue > 99 ? "99+" : badgeValue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-cream-300 p-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <div
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-200 border border-cream-300 font-display text-sm font-semibold text-forest-800"
          >
            {borrowerName[0]?.toUpperCase() ?? "B"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-[13px] font-semibold text-forest-800">
              {borrowerName}
            </div>
            {location && (
              <div className="truncate font-mono text-[10px] text-sage-500">
                {location}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={signingOut}
          className="mt-1 flex max-md:min-h-[44px] w-full items-center gap-2 rounded-sm px-3 py-2.5 text-[12px] text-forest-700/70 transition-colors hover:bg-cream-200 hover:text-forest-800 disabled:opacity-60"
        >
          <span className="font-mono text-sage-400" aria-hidden>
            ⇥
          </span>
          {signingOut
            ? t("nav.loggingOut", "Signing out…")
            : t("nav.signOut", "Sign Out")}
        </button>
      </div>

      {confirmOpen && (
        <SignOutConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setConfirmOpen(false);
            await handleSignOut();
          }}
          busy={signingOut}
          t={t}
        />
      )}
    </aside>
  );
}

function SignOutConfirmModal({
  onCancel,
  onConfirm,
  busy,
  t,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.logoutConfirmTitle", "Sign out of your account?")}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-forest-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-sm border border-cream-300 bg-cream-50 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-forest-800">
          {t("nav.logoutConfirmTitle", "Sign out of your account?")}
        </h3>
        <p className="mt-2 font-body text-[13px] text-sage-500">
          {t(
            "nav.logoutConfirmDesc",
            "You'll be signed out of your current session. You can sign back in at any time.",
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-sm border border-cream-300 px-4 py-2.5 font-body text-sm font-medium text-forest-700 transition-colors hover:bg-cream-200 disabled:opacity-60"
          >
            {t("nav.logoutCancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-sm bg-error-500 px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-error-600 disabled:opacity-60"
          >
            {busy
              ? t("nav.loggingOut", "Signing out…")
              : t("nav.logoutConfirm", "Sign Out")}
          </button>
        </div>
      </div>
    </div>
  );
}
