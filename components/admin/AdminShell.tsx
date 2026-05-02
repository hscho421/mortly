import { useCallback, useEffect, useRef, useState, createContext, useContext, ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { useAdminData } from "@/lib/admin/AdminDataContext";

/**
 * Unified admin chrome. Owns:
 *   - auth gate + redirect
 *   - 72px left rail + top bar + content slot
 *   - ⌘K / Ctrl+K palette mount
 *   - `CommandPaletteContext` (so pages can open the palette programmatically)
 *
 * Badge counts + inbox queue come from `AdminDataProvider` (one polling loop
 * shared across all admin pages — see lib/admin/AdminDataContext.tsx).
 */

type NavKey = "inbox" | "people" | "activity" | "reports" | "system";

interface NavItem {
  k: NavKey;
  href: string;
  icon: string;
  labelKey: string;
  fallback: string;
  /** count key from AdminDataContext.badges; undefined items don't show a dot */
  badgeKey?: "pendingVerifications" | "pendingRequests" | "openReports" | "inbox";
  urgent?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { k: "inbox",    href: "/admin/inbox",    icon: "⟐", labelKey: "admin.nav.inbox",    fallback: "인박스", badgeKey: "inbox",              urgent: true },
  { k: "people",   href: "/admin/people",   icon: "◉", labelKey: "admin.nav.people",   fallback: "사용자" },
  { k: "activity", href: "/admin/activity", icon: "⧉", labelKey: "admin.nav.activity", fallback: "활동" },
  { k: "reports",  href: "/admin/reports",  icon: "△", labelKey: "admin.nav.reports",  fallback: "신고",   badgeKey: "openReports",         urgent: true },
  { k: "system",   href: "/admin/system",   icon: "⚙", labelKey: "admin.nav.system",   fallback: "시스템" },
];

// ──────────────────────────────────────────────────────────────
// Command-palette context — pages can call `useCommandPalette()`
// to open it programmatically (e.g. via a top-bar click).
// ──────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

// ──────────────────────────────────────────────────────────────
// Shell
// ──────────────────────────────────────────────────────────────

export interface AdminShellProps {
  active: NavKey;
  children: ReactNode;
  /** Page title for <title>. Falls back to "Admin — mortly". */
  pageTitle?: string;
}

export default function AdminShell({ active, children, pageTitle }: AdminShellProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation("common");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [PaletteComp, setPaletteComp] = useState<React.ComponentType<{ onClose: () => void }> | null>(null);

  // Auth gate — mirror old AdminLayout
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
    }
  }, [session, status, router]);

  // ⌘K / Ctrl+K global shortcut + lazy-load the palette on first open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  useEffect(() => {
    if (paletteOpen && !PaletteComp) {
      import("./CommandPalette").then((m) => {
        setPaletteComp(() => m.default);
      });
    }
  }, [paletteOpen, PaletteComp]);

  // Loading / unauthorized states — no shell, just a blank page so auth
  // redirect can happen without flashing the rail.
  if (status === "loading" || !session || session.user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream-100">
        <p className="font-body text-sm text-sage-500">{t("common.loading")}</p>
      </div>
    );
  }

  const adminName =
    session.user.name ||
    (session.user.email ? session.user.email.split("@")[0] : "ADMIN");

  // Note: AdminDataProvider is mounted in _app.tsx under AdminScope so it sits
  // ABOVE the page's component body — pages can call useAdminData() at the top
  // of their function and still see the provider's value.
  return (
    <CommandPaletteContext.Provider value={{ open: paletteOpen, setOpen: setPaletteOpen }}>
      <Head>
        <title>{pageTitle ? pageTitle : "Admin — mortly"}</title>
      </Head>
      <AdminShellChrome
        active={active}
        adminName={adminName}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
      >
        {children}
      </AdminShellChrome>
      {paletteOpen && PaletteComp && <PaletteComp onClose={() => setPaletteOpen(false)} />}
    </CommandPaletteContext.Provider>
  );
}

// ──────────────────────────────────────────────────────────────
// Inner chrome — reads useAdminData() now that the provider is above.
// ──────────────────────────────────────────────────────────────

function AdminShellChrome({
  active,
  adminName,
  paletteOpen,
  setPaletteOpen,
  children,
}: {
  active: NavKey;
  adminName: string;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  const { badges, badgesLoaded, error } = useAdminData();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-cream-100 text-forest-800">
      {/* ── Left rail ─────────────────────────────────── */}
      <aside className="w-[72px] shrink-0 flex flex-col items-center py-4 bg-forest-800 text-cream-100">
        <Link
          href="/admin/inbox"
          className="font-display text-[22px] font-medium leading-none tracking-tight"
          title="mortly admin"
        >
          m<span className="text-amber-500 italic">.</span>
        </Link>
        <div className="mt-1 font-mono text-[8px] tracking-[0.2em] text-cream-100/40">ADMIN</div>

        <nav className="flex-1 mt-7 w-full px-2 flex flex-col gap-1">
          {NAV_ITEMS.map((it) => {
            const on = active === it.k;
            const count = it.badgeKey ? badges[it.badgeKey] : 0;
            const showBadge = badgesLoaded && count > 0;
            return (
              <Link
                key={it.k}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`relative py-2.5 rounded-sm text-center transition-colors ${
                  on
                    ? "bg-amber-500 text-white"
                    : "text-cream-100/70 hover:text-cream-100 hover:bg-forest-700"
                }`}
                title={t(it.labelKey, it.fallback)}
              >
                <div className="font-mono text-base">{it.icon}</div>
                <div className="text-[9px] tracking-wider mt-0.5 leading-none">
                  {t(it.labelKey, it.fallback)}
                </div>
                {showBadge && (
                  <span
                    className={`absolute top-1 right-1.5 w-4 h-4 rounded-full font-mono text-[9px] font-bold flex items-center justify-center ${
                      it.urgent ? "bg-error-600 text-white" : "bg-cream-100/20 text-white"
                    }`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <AdminAvatarMenu adminName={adminName} />
      </aside>

      {/* ── Main column ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-5 px-7 py-3.5 border-b border-cream-300 bg-cream-50">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-2 bg-cream-100 border border-cream-300 rounded-sm flex-1 max-w-[560px] text-left text-[13px] text-sage-500 hover:border-forest-300 transition-colors"
          >
            <span className="font-mono text-sage-500">⌘K</span>
            <span className="flex-1 truncate">
              {t("admin.commandHint", "ID, 이메일, 이름 검색 · 빠른 작업 실행…")}
            </span>
            <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 bg-cream-50 border border-cream-300 rounded-sm">
              ⌘K
            </span>
          </button>

          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-sage-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
              {t("admin.systemStatus", "모든 시스템 정상")}
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-amber-200 bg-amber-50 text-amber-700 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase">
              {adminName} · ADMIN
            </span>
          </div>
        </div>

        {/* Persistent error banner — surfaces backend failures so admins
            don't act on stale badges. Previously errors were console-only. */}
        {error ? (
          <div
            role="status"
            className="border-b border-error-200 bg-error-50 px-6 py-2 text-body-sm text-error-700"
          >
            {t("admin.dataStale", "Some data may be out of date — ")}
            <span className="font-mono text-xs">{error}</span>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Avatar + sign-out menu
// ──────────────────────────────────────────────────────────────

function AdminAvatarMenu({ adminName }: { adminName: string }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div ref={wrapRef} className="relative w-full px-2 mt-2">
      <button
        type="button"
        title={adminName}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 mx-auto block rounded-full border flex items-center justify-center text-[11px] font-semibold transition-colors ${
          open
            ? "bg-amber-500 border-amber-500 text-white"
            : "bg-cream-100/10 border-cream-100/15 text-cream-100 hover:bg-cream-100/15"
        }`}
      >
        {adminName[0]?.toUpperCase() || "A"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-[calc(100%+8px)] bottom-0 z-40 w-48 bg-cream-50 border border-forest-800 rounded-sm shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-cream-300">
            <div className="text-[13px] font-medium text-forest-800 truncate">{adminName}</div>
            <div className="font-mono text-[10px] text-sage-500 tracking-wider uppercase">Admin</div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full px-3 py-2.5 text-left text-[13px] text-forest-800 hover:bg-cream-200 flex items-center gap-2"
          >
            <span className="font-mono text-sage-500 text-[13px]">⇥</span>
            {t("admin.shell.signOut", "로그아웃")}
          </button>
        </div>
      )}
    </div>
  );
}
