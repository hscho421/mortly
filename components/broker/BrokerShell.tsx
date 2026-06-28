import React, { ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import BrandMark from "@/components/BrandMark";
import Avatar from "@/components/Avatar";
import MobileTabBar from "@/components/MobileTabBar";
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

// Bottom-tab-bar primary destinations on mobile; the rest go to the "More" sheet.
const MOBILE_PRIMARY: BrokerNavKey[] = ["dashboard", "requests", "messages"];

export interface BrokerShellProps {
  active: BrokerNavKey;
  pageTitle?: string;
  children: ReactNode;
  /**
   * Bypass the profile requirement (default false).
   * Set true on /broker/onboarding so we don't loop redirect onto itself.
   */
  skipProfileGate?: boolean;
  /** Hide the mobile bottom tab bar (e.g. the chat detail view owns the bottom). */
  hideMobileTabBar?: boolean;
}

export default function BrokerShell({
  active,
  pageTitle,
  children,
  skipProfileGate = false,
  hideMobileTabBar = false,
}: BrokerShellProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation("common");
  const { profile, profileChecked, counters } = useBrokerData();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  // Auth gate. Using router.replace so the back button doesn't return here.
  // callbackUrl brings the visitor back after login (login.tsx honors it).
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(router.asPath)}`,
        undefined,
        { locale: router.locale },
      );
    }
  }, [session, status, router]);

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
        pastDue={profile?.subscription?.status === "PAST_DUE"}
        photoPath={profile?.profilePhoto ?? null}
        photoVersion={profile?.updatedAt ?? null}
        className="hidden md:flex"
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Profile-gate banner when broker hasn't onboarded yet. */}
        {!skipProfileGate && profileChecked && !profile && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 md:px-6 py-3 text-sm text-amber-800">
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
              it.badge === "newRequests"
                ? counters.newRequests
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
          accountName={brokerName}
          accountSubtitle={profile?.brokerageName ?? null}
          photoPath={profile?.profilePhoto ?? null}
          photoVersion={profile?.updatedAt ?? null}
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
// Sidebar — same component used for both the persistent desktop
// rail and the mobile slide-over.
// ──────────────────────────────────────────────────────────────
function Sidebar({
  active,
  counters,
  brokerName,
  brokerageName,
  subscriptionTier,
  pastDue = false,
  photoPath,
  photoVersion,
  className = "",
}: {
  active: BrokerNavKey;
  counters: { newRequests: number; unreadMessages: number; activeConversations: number };
  brokerName: string;
  brokerageName: string | null;
  subscriptionTier: string | null;
  pastDue?: boolean;
  photoPath?: string | null;
  photoVersion?: string | null;
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
      className={`flex h-full w-[240px] shrink-0 flex-col border-r border-cream-300 bg-cream-50 ${className}`}
    >
      <div className="flex items-baseline justify-between border-b border-cream-300 px-5 py-4">
        <BrandMark href="/broker/dashboard" className="h-7 w-auto" />
        {/* Plan label beside the brand mark. While PAST_DUE the tier still reads
            its paid value (e.g. "BASIC"), so the lapse is flagged with a single
            small amber dot + tooltip rather than crowding the logo with
            "· 결제 필요" text — the actionable detail lives in the dashboard's
            past-due banner. */}
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-sage-500"
          title={pastDue ? t("broker.paymentDue", "결제 필요") : undefined}
        >
          {subscriptionTier || t("broker.tagline", "BROKER")}
          {pastDue && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
              role="img"
              aria-label={t("broker.paymentDue", "결제 필요")}
            />
          )}
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
          <Avatar name={brokerName} photoPath={photoPath} version={photoVersion} size={36} />
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
