import React, { ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import BrandMark from "@/components/BrandMark";
import { useBrokerData } from "./BrokerDataContext";

/**
 * BrokerShell — unified broker-app chrome.
 *
 * Owns:
 *   • Auth gate. If no session / wrong role → hard redirect to /login.
 *     We render a minimal cream viewport during the redirect so no marketing
 *     chrome flashes (the public Navbar is never mounted on /broker/*).
 *   • Persistent 240px sidebar with editorial navigation, active state,
 *     unread/new counters pulled from BrokerDataContext.
 *   • Mobile top bar with hamburger → slide-over sidebar.
 *
 * It intentionally does NOT render the per-page <AppTopbar>. Pages own their
 * own topbar so each page can set its eyebrow / title / actions without a
 * prop-drilling mess.
 */

export type BrokerNavKey =
  | "dashboard"
  | "requests"
  | "messages"
  | "profile"
  | "billing"
  | "settings";

interface NavItem {
  key: BrokerNavKey;
  href: string;
  labelKey: string;
  fallback: string;
  glyph: string;
  /** Key on BrokerCounters to render a badge. */
  badge?: "newRequests" | "unreadMessages";
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/broker/dashboard",
    labelKey: "broker.nav.dashboard",
    fallback: "대시보드",
    glyph: "◈",
  },
  {
    key: "requests",
    href: "/broker/requests",
    labelKey: "broker.nav.requests",
    fallback: "상담 요청",
    glyph: "⊹",
    badge: "newRequests",
  },
  {
    key: "messages",
    href: "/broker/messages",
    labelKey: "broker.nav.messages",
    fallback: "대화",
    glyph: "✉",
    badge: "unreadMessages",
  },
  {
    key: "profile",
    href: "/broker/profile",
    labelKey: "broker.nav.profile",
    fallback: "내 프로필",
    glyph: "❋",
  },
  {
    key: "billing",
    href: "/broker/billing",
    labelKey: "broker.nav.billing",
    fallback: "크레딧·결제",
    glyph: "¤",
  },
];

export interface BrokerShellProps {
  active: BrokerNavKey;
  pageTitle?: string;
  children: ReactNode;
  /**
   * Bypass the profile requirement (default false).
   * Set true on /broker/onboarding so we don't loop redirect onto itself.
   */
  skipProfileGate?: boolean;
}

export default function BrokerShell({
  active,
  pageTitle,
  children,
  skipProfileGate = false,
}: BrokerShellProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation("common");
  const { profile, profileChecked, counters } = useBrokerData();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auth gate. Using router.replace so the back button doesn't return here.
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.replace("/login", undefined, { locale: router.locale });
    }
  }, [session, status, router]);

  // Close mobile nav on route change.
  useEffect(() => {
    const close = () => setMobileNavOpen(false);
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  // Escape closes the mobile nav drawer.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const loadingAuth = status === "loading" || !session || session.user.role !== "BROKER";

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 text-forest-800">
        <Head>
          <title>{pageTitle ?? "Broker — mortly"}</title>
        </Head>
        <p className="font-body text-sm text-sage-500">{t("common.loading", "Loading…")}</p>
      </div>
    );
  }

  const brokerName =
    profile?.user?.name ||
    session.user.name ||
    (session.user.email ? session.user.email.split("@")[0] : "Broker");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-cream-100 text-forest-800">
      <Head>
        <title>{pageTitle ?? "Broker — mortly"}</title>
      </Head>

      <a href="#main-content" className="skip-link">
        {t("misc.skipToContent", "Skip to content")}
      </a>

      {/* Desktop sidebar */}
      <Sidebar
        active={active}
        counters={counters}
        brokerName={brokerName}
        brokerageName={profile?.brokerageName ?? null}
        subscriptionTier={profile?.subscriptionTier ?? null}
        className="hidden md:flex"
      />

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label={t("broker.closeNav", "Close navigation")}
          className="fixed inset-0 z-40 bg-forest-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      {mobileNavOpen && (
        <div
          className="fixed inset-y-0 left-0 z-50 md:hidden animate-[slideInLeft_0.2s_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-label="Broker navigation"
        >
          <Sidebar
            active={active}
            counters={counters}
            brokerName={brokerName}
            brokerageName={profile?.brokerageName ?? null}
            subscriptionTier={profile?.subscriptionTier ?? null}
          />
        </div>
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar — shown only on < md */}
        <div className="flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-sm border border-cream-300 bg-cream-50 text-forest-700"
            aria-label={t("broker.openNav", "Open navigation")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          </button>
          <BrandMark href="/broker/dashboard" className="h-6 w-auto" />
          <div className="w-9" aria-hidden />
        </div>

        {/* Profile-gate banner when broker hasn't onboarded yet. */}
        {!skipProfileGate && profileChecked && !profile && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            {t(
              "broker.completeProfilePrompt",
              "Complete your broker profile to access the marketplace.",
            )}{" "}
            <Link
              href="/broker/onboarding"
              className="font-semibold underline underline-offset-2"
            >
              {t("broker.goToOnboarding", "Finish onboarding →")}
            </Link>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sidebar — same component used for both the persistent desktop
// rail and the mobile slide-over.
// ──────────────────────────────────────────────────────────────
function Sidebar({
  active,
  counters,
  brokerName,
  brokerageName,
  subscriptionTier,
  className = "",
}: {
  active: BrokerNavKey;
  counters: { newRequests: number; unreadMessages: number; activeConversations: number };
  brokerName: string;
  brokerageName: string | null;
  subscriptionTier: string | null;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Redirect to /login (not /) on sign out.
  //
  // Why: the public homepage renders the marketing Navbar, which reads
  // useSession(). The client session cache can hold the prior broker
  // session for ~100-500ms before the post-signout refetch lands, briefly
  // painting "Dashboard / Messages" nav items on the homepage — making it
  // look like the user is still logged in. Landing on /login avoids the
  // issue entirely because that page has no session-dependent chrome.
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <aside
      className={`flex w-[240px] shrink-0 flex-col border-r border-cream-300 bg-cream-50 ${className}`}
    >
      <div className="flex items-baseline justify-between border-b border-cream-300 px-5 py-4">
        <BrandMark href="/broker/dashboard" className="h-7 w-auto" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sage-500">
          {subscriptionTier ? `${subscriptionTier} · PRO` : t("broker.tagline", "BROKER")}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Broker navigation">
        {NAV_ITEMS.map((it) => {
          const on = active === it.key;
          const badgeValue =
            it.badge === "newRequests"
              ? counters.newRequests
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
            {brokerName[0]?.toUpperCase() ?? "B"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-[13px] font-semibold text-forest-800">
              {brokerName}
            </div>
            <div className="truncate font-mono text-[10px] text-sage-500">
              {brokerageName ?? t("broker.tagline", "BROKER")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-[12px] text-forest-700/70 transition-colors hover:bg-cream-200 hover:text-forest-800 disabled:opacity-60"
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

// ──────────────────────────────────────────────────────────────
// SignOutConfirmModal — small confirmation dialog, same UX as the
// public Navbar's logout modal. Prevents accidental clicks.
// ──────────────────────────────────────────────────────────────
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
