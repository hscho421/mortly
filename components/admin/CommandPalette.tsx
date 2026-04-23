import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { ABadge } from "./primitives";

/**
 * Global command palette mounted by AdminShell. Keyboard-first:
 *   - Type to search users (hits /api/admin/users?search=X&limit=5)
 *   - ↑/↓ moves the cursor through a flat selectable list
 *   - ↵ executes the selected item
 *   - Esc / backdrop click closes
 *
 * Sections shown in order:
 *   1. USERS — /api/admin/users results for the current query
 *   2. QUICK ACTIONS — scoped to the currently-highlighted user (if any)
 *   3. NAV — jump shortcuts to the 5 main pages
 *
 * "Quick actions" that need an input (credit adjust, send notice) navigate
 * to the user detail page where the existing modal lives. Status changes
 * (suspend/ban/reactivate) hit the PUT /api/admin/users/[id] endpoint
 * directly with a confirm() gate — same safety net as the detail-page modal.
 */

interface AdminUser {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  broker?: {
    brokerageName: string;
    verificationStatus: string;
    subscriptionTier: string;
  } | null;
}

type QuickActionKey = "open" | "suspend" | "ban" | "reactivate" | "credits" | "notice";

interface NavTarget {
  key: string;
  href: string;
  label: string;
  icon: string;
}

type Selectable =
  | { kind: "user"; user: AdminUser; index: number }
  | { kind: "action"; user: AdminUser; action: QuickActionKey }
  | { kind: "nav"; target: NavTarget };

const STATUS_TONE: Record<AdminUser["status"], React.ComponentProps<typeof ABadge>["tone"]> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  BANNED: "danger",
};

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce query → API fetches
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch users when debounced query changes. AbortController ensures fast
  // typers never see a late-arriving earlier result overwrite a later one.
  useEffect(() => {
    if (debounced.length === 0) {
      setUsers([]);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(
          `/api/admin/users?search=${encodeURIComponent(debounced)}&limit=5`,
          { signal: ctl.signal },
        );
        if (!r.ok) {
          setUsers([]);
          return;
        }
        const data = await r.json();
        setUsers(Array.isArray(data.data) ? data.data : []);
        setCursor(0);
      } catch (err: unknown) {
        // AbortError is expected during rapid typing — swallow it.
        if ((err as { name?: string })?.name === "AbortError") return;
        setUsers([]);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctl.abort();
  }, [debounced]);

  // Flat list of everything keyboard-navigable, in display order.
  // Quick actions live under the currently-highlighted user.
  const nav = useMemo<NavTarget[]>(
    () => [
      { key: "inbox",    href: "/admin/inbox",    icon: "⟐", label: t("admin.nav.inbox", "인박스") },
      { key: "people",   href: "/admin/people",   icon: "◉", label: t("admin.nav.people", "사용자") },
      { key: "activity", href: "/admin/activity", icon: "⧉", label: t("admin.nav.activity", "활동") },
      { key: "reports",  href: "/admin/reports",  icon: "△", label: t("admin.nav.reports", "신고") },
      { key: "system",   href: "/admin/system",   icon: "⚙", label: t("admin.nav.system", "시스템") },
    ],
    [t],
  );

  const selectables = useMemo<Selectable[]>(() => {
    const items: Selectable[] = [];
    users.forEach((u, i) => items.push({ kind: "user", user: u, index: i }));

    // Quick actions sit under whichever user is focused.
    const focusedUser = users[cursor]; // cursor 0..users.length-1 = user row
    if (focusedUser && cursor < users.length) {
      const actions: QuickActionKey[] = ["open"];
      if (focusedUser.role !== "ADMIN") {
        if (focusedUser.status === "ACTIVE") {
          actions.push("suspend", "ban");
        } else {
          actions.push("reactivate");
        }
      }
      if (focusedUser.role === "BROKER") actions.push("credits");
      actions.push("notice");
      for (const a of actions) items.push({ kind: "action", user: focusedUser, action: a });
    }

    nav.forEach((n) => items.push({ kind: "nav", target: n }));
    return items;
  }, [users, cursor, nav]);

  // Close handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const executeAction = useCallback(
    async (user: AdminUser, action: QuickActionKey) => {
      const go = (path: string) => {
        onClose();
        router.push(path);
      };
      switch (action) {
        case "open":
          return go(`/admin/users/${user.publicId}`);
        case "credits":
        case "notice":
          // These require modal inputs — route to the detail page.
          return go(`/admin/users/${user.publicId}`);
        case "suspend":
        case "ban":
        case "reactivate": {
          // The palette's tight-surface UX is not a good home for a full
          // AConfirmDialog — instead we route the admin to the user detail
          // page where the proper confirm dialog (with per-action title and
          // danger tone) lives. Matches "open" behavior: navigate, don't
          // mutate from inside a 620px command strip.
          return go(`/admin/users/${user.publicId}`);
        }
      }
    },
    [onClose, router, t],
  );

  // Keyboard handling on the input — arrows + enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, selectables.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = selectables[cursor];
      if (!item) return;
      if (item.kind === "user") {
        executeAction(item.user, "open");
      } else if (item.kind === "action") {
        executeAction(item.user, item.action);
      } else if (item.kind === "nav") {
        onClose();
        router.push(item.target.href);
      }
    }
  };

  // Scroll cursor into view when it moves
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-index="${cursor}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // ── Render helpers ─────────────────────────────────
  const actionLabel = (a: QuickActionKey) => {
    switch (a) {
      case "open": return { icon: "▶", label: t("admin.palette.action.open", "프로필 열기") };
      case "suspend": return { icon: "⊘", label: t("admin.palette.action.suspend", "계정 정지") };
      case "ban": return { icon: "×", label: t("admin.palette.action.ban", "계정 차단") };
      case "reactivate": return { icon: "✓", label: t("admin.palette.action.reactivate", "계정 재활성화") };
      case "credits": return { icon: "¤", label: t("admin.palette.action.credits", "크레딧 조정") };
      case "notice": return { icon: "✉", label: t("admin.palette.action.notice", "관리자 공지 발송") };
    }
  };

  let renderIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-forest-800/55 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-[620px] max-w-[calc(100vw-2rem)] bg-cream-100 border border-forest-800 rounded-sm shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search box */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-300 bg-cream-50">
          <span className="font-mono text-[13px] text-amber-600">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("admin.palette.placeholder", "ID, 이메일, 이름 검색…")}
            className="flex-1 bg-transparent outline-none text-[15px] text-forest-800 font-body placeholder:text-sage-400"
          />
          <span className="font-mono text-[10px] text-sage-500">
            {loading
              ? t("admin.palette.searching", "검색 중…")
              : debounced
                  ? t("admin.palette.resultCount", "{{n}} 결과", { n: users.length })
                  : ""}
          </span>
        </div>

        {/* Body */}
        <div ref={listRef} className="max-h-[500px] overflow-y-auto py-2">
          {/* Users section */}
          {users.length > 0 && (
            <>
              <div className="px-5 py-1.5 font-mono text-[9px] text-sage-500 uppercase tracking-[0.2em]">
                {t("admin.palette.section.users", "사용자")} · {users.length}
              </div>
              {users.map((u) => {
                const myIndex = renderIndex++;
                const selected = cursor === myIndex;
                const subline = [
                  u.publicId,
                  u.role,
                  u.broker?.subscriptionTier,
                  u.status,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={u.id}
                    type="button"
                    data-cmd-index={myIndex}
                    onMouseEnter={() => setCursor(myIndex)}
                    onClick={() => executeAction(u, "open")}
                    className={`w-full text-left px-5 py-2.5 grid grid-cols-[60px_1fr_auto] gap-3.5 items-center border-l-[3px] ${
                      selected
                        ? "bg-amber-50 border-amber-500"
                        : "border-transparent hover:bg-cream-200/60"
                    }`}
                  >
                    <ABadge tone="neutral">USER</ABadge>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-forest-800 truncate">
                        {u.name || u.email}
                      </div>
                      <div className="font-mono text-[11px] text-sage-500 truncate">
                        {subline}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ABadge tone={STATUS_TONE[u.status]}>{u.status}</ABadge>
                      {selected && (
                        <span className="font-mono text-[10px] text-amber-600 px-1.5 py-0.5 border border-amber-200 bg-cream-50 rounded-sm">
                          ↵
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Quick actions for the focused user */}
          {(() => {
            const focused = users[cursor];
            if (!focused || cursor >= users.length) return null;
            const actionItems = selectables.filter(
              (s): s is Extract<Selectable, { kind: "action" }> => s.kind === "action",
            );
            if (actionItems.length === 0) return null;
            return (
              <>
                <div className="px-5 pt-3 pb-1.5 font-mono text-[9px] text-sage-500 uppercase tracking-[0.2em]">
                  {t("admin.palette.section.quickActions", "빠른 작업")} · {focused.name || focused.email}
                </div>
                {actionItems.map((it) => {
                  const myIndex = renderIndex++;
                  const selected = cursor === myIndex;
                  const al = actionLabel(it.action);
                  return (
                    <button
                      key={it.action}
                      type="button"
                      data-cmd-index={myIndex}
                      onMouseEnter={() => setCursor(myIndex)}
                      onClick={() => executeAction(focused, it.action)}
                      className={`w-full text-left px-5 py-2.5 grid grid-cols-[60px_1fr_auto] gap-3.5 items-center border-l-[3px] ${
                        selected
                          ? "bg-amber-50 border-amber-500"
                          : "border-transparent hover:bg-cream-200/60"
                      }`}
                    >
                      <span className="font-mono text-sage-500 text-center">{al.icon}</span>
                      <span className="text-[13px] text-forest-800">{al.label}</span>
                      {selected && (
                        <span className="font-mono text-[10px] text-amber-600 px-1.5 py-0.5 border border-amber-200 bg-cream-50 rounded-sm">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            );
          })()}

          {/* Navigation (always visible) */}
          <div className="px-5 pt-3 pb-1.5 font-mono text-[9px] text-sage-500 uppercase tracking-[0.2em]">
            {t("admin.palette.section.nav", "이동")} · {nav.length}
          </div>
          {nav.map((n) => {
            const myIndex = renderIndex++;
            const selected = cursor === myIndex;
            return (
              <button
                key={n.key}
                type="button"
                data-cmd-index={myIndex}
                onMouseEnter={() => setCursor(myIndex)}
                onClick={() => {
                  onClose();
                  router.push(n.href);
                }}
                className={`w-full text-left px-5 py-2.5 grid grid-cols-[60px_1fr_auto] gap-3.5 items-center border-l-[3px] ${
                  selected
                    ? "bg-amber-50 border-amber-500"
                    : "border-transparent hover:bg-cream-200/60"
                }`}
              >
                <span className="font-mono text-sage-500 text-center">{n.icon}</span>
                <span className="text-[13px] text-forest-800">{n.label}</span>
                {selected && (
                  <span className="font-mono text-[10px] text-amber-600 px-1.5 py-0.5 border border-amber-200 bg-cream-50 rounded-sm">
                    ↵
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-cream-300 bg-cream-50 flex justify-between font-mono text-[10px] text-sage-500">
          <span>↑↓ {t("admin.palette.hint.move", "이동")} · ↵ {t("admin.palette.hint.select", "선택")}</span>
          <span>ESC {t("admin.palette.hint.close", "닫기")}</span>
        </div>
      </div>
    </div>
  );
}
