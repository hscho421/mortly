import type { ReactNode } from "react";

export interface AEmptyProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: ReactNode;
}

export default function AEmpty({ icon = "◌", title, body, cta }: AEmptyProps) {
  return (
    <div className="py-12 px-8 text-center border border-dashed border-cream-300 rounded-sm bg-cream-50">
      <div className="text-4xl font-display text-sage-400">{icon}</div>
      <div className="font-display font-semibold text-xl text-forest-800 mt-3">{title}</div>
      {body && (
        <div className="font-body text-[13px] text-sage-500 mt-1.5 max-w-sm mx-auto">{body}</div>
      )}
      {cta && <div className="mt-5 inline-flex">{cta}</div>}
    </div>
  );
}
