import { useEffect, useRef } from "react";

/**
 * A single keyboard shortcut. `key` is the `KeyboardEvent.key` value
 * (`"j"`, `"ArrowDown"`, `"Enter"`, …) or a list of synonyms.
 */
export interface ShortcutSpec {
  key: string | string[];
  handler: (e: KeyboardEvent) => void;
  /** Require Meta/Ctrl to be pressed. Defaults to `false`. */
  meta?: boolean;
  /**
   * Skip the handler when the event target is a form control or
   * contentEditable surface. Defaults to `true` because otherwise J/K-style
   * bindings collide with typing in search inputs.
   */
  ignoreInForm?: boolean;
  /** Call `preventDefault()` when the shortcut fires. Defaults to `true`. */
  preventDefault?: boolean;
}

/**
 * Keyboard shortcut utility shared across admin list pages.
 *
 * Previously each page registered its own `keydown` listener with a bespoke
 * form-input guard (see `pages/admin/inbox.tsx:152-188`). Centralizing here
 * keeps the semantics consistent (typing in search won't trigger a row move,
 * Meta/Ctrl combinations are explicit, preventDefault is on by default).
 *
 * The shortcut array is captured behind a ref so the installed listener is
 * stable — callers can pass inline handlers without re-binding window
 * listeners on every render.
 */
export function useAdminShortcuts(shortcuts: ShortcutSpec[], enabled = true): void {
  const ref = useRef(shortcuts);
  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inForm = tag === "INPUT" || tag === "TEXTAREA" || Boolean(target?.isContentEditable);

      for (const s of ref.current) {
        const keys = Array.isArray(s.key) ? s.key : [s.key];
        if (!keys.includes(e.key)) continue;
        const wantMeta = s.meta ?? false;
        const hasMeta = e.metaKey || e.ctrlKey;
        if (wantMeta && !hasMeta) continue;
        if (!wantMeta && hasMeta) continue;
        if ((s.ignoreInForm ?? true) && inForm) continue;
        if (s.preventDefault ?? true) e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
