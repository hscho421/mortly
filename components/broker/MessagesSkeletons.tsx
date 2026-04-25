import { Skeleton } from "@/components/Skeleton";

/**
 * Per-pane skeletons for /broker/messages.
 *
 * The messages page has three distinct async regions — the conversation list
 * (left), the active thread (middle), and the request context panel (right).
 * Each region has its own loading state so we render skeletons that match the
 * cadence of what replaces them. This keeps layout shift to zero when data
 * lands.
 *
 * The skeletons reuse the existing `Skeleton` atom from components/Skeleton
 * so `prefers-reduced-motion` handling stays consistent.
 */

// ── ConversationListSkeleton ────────────────────────────────
// Matches the real list item: avatar + two text rows. 6 rows is enough to
// paint the first visible page without scrolling.
export function ConversationListSkeleton() {
  return (
    <div aria-hidden="true" className="divide-y divide-cream-200">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ThreadSkeleton ──────────────────────────────────────────
// Alternating left/right bubbles to hint at the chat shape. The date divider
// lives above the first row.
export function ThreadSkeleton() {
  const rows = [
    { mine: false, w: "w-60" },
    { mine: false, w: "w-40" },
    { mine: true, w: "w-52" },
    { mine: true, w: "w-32" },
    { mine: false, w: "w-48" },
    { mine: true, w: "w-56" },
  ];
  return (
    <div aria-hidden="true" className="space-y-3 px-5 py-4">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-cream-300" />
        <Skeleton className="h-3 w-20" />
        <div className="h-px flex-1 bg-cream-300" />
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex ${r.mine ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`${r.w} rounded-sm px-4 py-3 ${
              r.mine
                ? "bg-forest-800/10 border border-forest-800/10"
                : "bg-white border border-cream-300"
            }`}
          >
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-4/5" />
            <Skeleton className="mt-1.5 h-2 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── RequestContextSkeleton ──────────────────────────────────
// Matches the context panel: header, badges row, title + region, fact rows.
// Always renders a sensible shape even if there's no request data yet.
export function RequestContextSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="flex h-full w-full flex-col border-l border-cream-300 bg-cream-50"
    >
      <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="ml-auto h-3 w-20" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>

        <div className="space-y-2 rounded-sm border border-cream-300 bg-cream-100 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="space-y-2 rounded-sm border border-cream-300 bg-cream-100 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      <div className="border-t border-cream-300 px-5 py-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </aside>
  );
}
