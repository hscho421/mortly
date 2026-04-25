import type { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** optional count rendered as a chip next to the label */
  badge?: number;
}

export interface ATabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** Extra content rendered to the right of the tabs, aligned with the underline */
  right?: ReactNode;
}

export default function ATabs({ items, active, onChange, right }: ATabsProps) {
  return (
    <div className="flex items-end border-b border-cream-300">
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`px-4 py-2.5 text-[13px] -mb-px inline-flex items-center gap-2 transition-colors ${
              on
                ? "text-forest-800 font-semibold border-b-2 border-amber-500"
                : "text-sage-500 border-b-2 border-transparent hover:text-forest-700"
            }`}
          >
            {it.label}
            {it.badge != null && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full font-mono text-[10px] font-bold ${
                  on ? "bg-amber-500 text-white" : "bg-cream-200 text-sage-500"
                }`}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
      {right && <div className="ml-auto pb-2">{right}</div>}
    </div>
  );
}
