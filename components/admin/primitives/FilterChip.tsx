import type { ReactNode } from "react";

export interface FilterChipProps {
  label: ReactNode;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  /** When true, renders a thin vertical divider instead of a chip. */
  divider?: boolean;
  className?: string;
}

/**
 * Chip used in the filter rows on Inbox / People / Activity / Reports.
 * Passing `divider` short-circuits everything else and renders a spacer.
 */
export default function FilterChip({
  label,
  count,
  active,
  onClick,
  divider,
  className = "",
}: FilterChipProps) {
  if (divider) {
    return <span className="w-px h-6 bg-cream-300 mx-1 self-center" aria-hidden />;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs border transition-colors ${
        active
          ? "bg-forest-800 text-cream-100 border-forest-800 font-semibold"
          : "bg-cream-50 text-forest-700 border-cream-300 hover:border-forest-300"
      } ${className}`}
    >
      <span>{label}</span>
      {count != null && (
        <span
          className={`font-mono text-[10px] ${active ? "text-cream-200/80" : "text-sage-500"}`}
        >
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}
