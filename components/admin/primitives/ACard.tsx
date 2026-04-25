import type { HTMLAttributes, ReactNode } from "react";

export interface ACardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** pixel padding. Pass 0 for flush (e.g. when the card contains its own rows). */
  pad?: number;
}

export default function ACard({ children, pad = 24, style, className = "", ...rest }: ACardProps) {
  return (
    <div
      className={`bg-cream-50 border border-cream-300 rounded-sm ${className}`}
      style={{ padding: pad, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
