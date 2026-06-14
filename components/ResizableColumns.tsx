import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Drag-to-resize for the messaging three-column layout (conversation list |
 * thread | request-context), shared by broker + borrower pages.
 *
 * The center thread is `flex-1`, so only the two fixed side columns are
 * resized; the thread auto-fills what's left. Active ONLY at lg+ (where all
 * three columns are visible) — below lg the hook returns `undefined` styles so
 * the pages' existing responsive Tailwind classes (and the mobile single-column
 * toggle) are untouched. Widths persist to localStorage per page; on first load
 * they default to the current design (list 384 / context 320).
 */

const DEFAULTS = { list: 384, context: 320 } as const; // lg:w-96 / w-80
const BOUNDS = {
  listMin: 260,
  listMax: 560,
  contextMin: 240,
  contextMax: 520,
  threadMin: 360, // never let the center thread collapse below this
} as const;

const LG_QUERY = "(min-width: 1024px)";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Pure width math for a drag (exported for testing). `dx` is the pointer delta
 * from drag start. The list grows as you drag right (+dx); the context column
 * lives on the right so it grows as you drag left (−dx). Both are clamped to
 * their bounds AND to leave the center thread at least `threadMin`.
 */
export function computeNextWidth(
  side: "list" | "context",
  startWidth: number,
  dx: number,
  total: number,
  otherWidth: number,
): number {
  const room = total - otherWidth - BOUNDS.threadMin;
  if (side === "list") {
    return clamp(startWidth + dx, BOUNDS.listMin, Math.min(BOUNDS.listMax, room));
  }
  return clamp(startWidth - dx, BOUNDS.contextMin, Math.min(BOUNDS.contextMax, room));
}

export interface ResizableColumns {
  /** Attach to the outer `flex h-full` row (used to bound the center thread). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** True at lg+ where the 3-column resize is active. */
  active: boolean;
  /** Inline width for the list column; undefined below lg (Tailwind applies). */
  listStyle: CSSProperties | undefined;
  /** Inline width for the context column; undefined below lg. */
  contextStyle: CSSProperties | undefined;
  onListHandleDown: (e: ReactPointerEvent) => void;
  onContextHandleDown: (e: ReactPointerEvent) => void;
  /** Double-click handlers restore the default width. */
  resetList: () => void;
  resetContext: () => void;
}

export function useResizableColumns(storageKey: string): ResizableColumns {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [list, setList] = useState<number>(DEFAULTS.list);
  const [context, setContext] = useState<number>(DEFAULTS.context);

  // Refs mirror state so drag math reads the latest without re-subscribing.
  const listRef = useRef(list);
  listRef.current = list;
  const contextRef = useRef(context);
  contextRef.current = context;

  // The whole feature is gated on lg+ (only there are all 3 columns shown).
  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const update = () => setActive(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Load saved widths once (clamped, tolerant of corrupt/missing data).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const v = JSON.parse(raw) as { list?: unknown; context?: unknown };
      if (typeof v.list === "number") setList(clamp(v.list, BOUNDS.listMin, BOUNDS.listMax));
      if (typeof v.context === "number")
        setContext(clamp(v.context, BOUNDS.contextMin, BOUNDS.contextMax));
    } catch {
      /* ignore corrupt prefs / private-mode access errors */
    }
  }, [storageKey]);

  const persist = useCallback(
    (l: number, c: number) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ list: l, context: c }));
      } catch {
        /* quota / private mode — non-fatal */
      }
    },
    [storageKey],
  );

  // Cleanup for an in-flight drag — invoked on pointerup/cancel AND on unmount,
  // so navigating away mid-drag never leaks window listeners or leaves the body
  // cursor / text-selection locked.
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const startDrag = useCallback(
    (which: "list" | "context", e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const startList = listRef.current;
      const startContext = contextRef.current;
      // Track the final value locally so persistence isn't subject to React's
      // async render timing on pointerup.
      let lastList = startList;
      let lastContext = startContext;
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;

      const onMove = (ev: PointerEvent) => {
        // Read the container width fresh each move so a mid-drag window resize
        // doesn't use a stale total. `|| innerWidth`: clientWidth is 0 for a
        // not-yet-laid-out element, which would wrongly collapse the guard.
        const total = containerRef.current?.clientWidth || window.innerWidth;
        const dx = ev.clientX - startX;
        if (which === "list") {
          lastList = computeNextWidth("list", startList, dx, total, contextRef.current);
          setList(lastList);
        } else {
          lastContext = computeNextWidth("context", startContext, dx, total, listRef.current);
          setContext(lastContext);
        }
      };
      let finished = false;
      const finish = () => {
        if (finished) return; // idempotent: pointerup + pointercancel + unmount
        finished = true;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        dragCleanupRef.current = null;
        persist(lastList, lastContext);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      dragCleanupRef.current = finish;
    },
    [persist],
  );

  const onListHandleDown = useCallback(
    (e: ReactPointerEvent) => startDrag("list", e),
    [startDrag],
  );
  const onContextHandleDown = useCallback(
    (e: ReactPointerEvent) => startDrag("context", e),
    [startDrag],
  );

  const resetList = useCallback(() => {
    setList(DEFAULTS.list);
    persist(DEFAULTS.list, contextRef.current);
  }, [persist]);
  const resetContext = useCallback(() => {
    setContext(DEFAULTS.context);
    persist(listRef.current, DEFAULTS.context);
  }, [persist]);

  return {
    containerRef,
    active,
    listStyle: active ? { width: list } : undefined,
    contextStyle: active ? { width: context } : undefined,
    onListHandleDown,
    onContextHandleDown,
    resetList,
    resetContext,
  };
}

/**
 * The grab strip between two columns. Hidden below lg (resize is a lg+ feature).
 * A 1px line (matching the cream borders) sits in a 6px hit area; it darkens on
 * hover/drag. Double-click resets the adjacent column to its default width.
 */
export function ColumnResizeHandle({
  onPointerDown,
  onDoubleClick,
  ariaLabel,
}: {
  onPointerDown: (e: ReactPointerEvent) => void;
  onDoubleClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      data-testid="column-resize-handle"
      className="group hidden shrink-0 cursor-col-resize items-stretch justify-center bg-transparent transition-colors hover:bg-cream-200/60 lg:flex"
      style={{ width: 6 }}
    >
      <div className="w-px self-stretch bg-cream-300 transition-colors group-hover:bg-forest-400 group-active:bg-forest-500" />
    </div>
  );
}
