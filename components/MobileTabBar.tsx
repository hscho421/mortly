import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Avatar from "@/components/Avatar";

export interface TabBarItem {
  key: string;
  href: string;
  label: string;
  glyph: string;
  badge?: number;
}

interface MobileTabBarProps {
  active: string;
  /** Primary destinations — always-visible tabs. */
  tabs: TabBarItem[];
  /** Secondary destinations — shown in the "More" sheet. */
  moreItems: TabBarItem[];
  moreLabel: string;
  closeLabel: string;
  accountName: string;
  accountSubtitle?: string | null;
  photoPath?: string | null;
  photoVersion?: string | null;
  signOutLabel: string;
  /** Open the sign-out confirm (owned by the shell). */
  onSignOut: () => void;
}

/**
 * MobileTabBar — native-style bottom navigation for the broker/borrower apps,
 * shown only below md (the persistent rail handles >= md). Primary destinations
 * are always visible and thumb-reachable; secondary destinations + sign-out live
 * in a "More" bottom sheet. Rendered as a flex sibling at the bottom of the shell
 * column so it never overlaps page content (including the chat composer).
 */
export default function MobileTabBar({
  active,
  tabs,
  moreItems,
  moreLabel,
  closeLabel,
  accountName,
  accountSubtitle,
  photoPath,
  photoVersion,
  signOutLabel,
  onSignOut,
}: MobileTabBarProps) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((m) => m.key === active);

  // Close the sheet on navigation.
  useEffect(() => {
    const close = () => setMoreOpen(false);
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const tabClass = (isActive: boolean) =>
    `relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
      isActive ? "text-amber-600" : "text-sage-500 hover:text-forest-700"
    }`;

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label={closeLabel}
            className="fixed inset-0 z-40 bg-forest-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 animate-slide-up border-t border-cream-300 bg-cream-50 pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            <div className="flex items-center gap-3 border-b border-cream-200 px-5 py-4">
              <Avatar name={accountName} photoPath={photoPath} version={photoVersion} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-body text-sm font-semibold text-forest-800">
                  {accountName}
                </div>
                {accountSubtitle && (
                  <div className="truncate font-mono text-[10px] text-sage-500">
                    {accountSubtitle}
                  </div>
                )}
              </div>
            </div>
            <div className="p-2">
              {moreItems.map((m) => (
                <Link
                  key={m.key}
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={m.key === active ? "page" : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-sm px-3 text-[14px] transition-colors ${
                    m.key === active
                      ? "bg-amber-50 font-semibold text-forest-800"
                      : "text-forest-700/90 hover:bg-cream-200 hover:text-forest-800"
                  }`}
                >
                  <span className="w-5 font-mono text-sage-400" aria-hidden>
                    {m.glyph}
                  </span>
                  {m.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onSignOut();
                }}
                className="mt-1 flex min-h-[48px] w-full items-center gap-3 rounded-sm px-3 text-[14px] text-forest-700/70 transition-colors hover:bg-cream-200 hover:text-forest-800"
              >
                <span className="w-5 font-mono text-sage-400" aria-hidden>
                  ⇥
                </span>
                {signOutLabel}
              </button>
            </div>
          </div>
        </>
      )}

      <nav
        aria-label="Primary"
        className="flex shrink-0 border-t border-cream-300 bg-cream-50 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={tabClass(isActive)}
            >
              {isActive && (
                <span
                  className="absolute inset-x-4 top-0 h-0.5 rounded-sm bg-amber-500"
                  aria-hidden
                />
              )}
              <span className="relative text-[17px] leading-none" aria-hidden>
                {tab.glyph}
                {tab.badge ? (
                  <span className="absolute -right-2.5 -top-1.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-sm bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? "page" : undefined}
          className={tabClass(moreActive || moreOpen)}
        >
          <span className="text-[17px] leading-none" aria-hidden>
            ⋯
          </span>
          <span>{moreLabel}</span>
        </button>
      </nav>
    </>
  );
}
