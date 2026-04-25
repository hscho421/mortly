import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant =
  | "primary"
  | "dark"
  | "ghost"
  | "subtle"
  | "success"
  | "danger"
  | "link";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 hover:border-amber-600",
  dark: "bg-forest-800 text-cream-100 border border-forest-800 hover:bg-forest-700",
  ghost:
    "bg-transparent text-forest-800 border border-cream-300 hover:bg-cream-200",
  subtle:
    "bg-cream-100 text-forest-800 border border-cream-300 hover:bg-cream-200",
  success:
    "bg-success-700 text-white border border-success-700 hover:bg-success-600",
  danger:
    "bg-error-700 text-white border border-error-700 hover:bg-error-600",
  link: "bg-transparent text-forest-800 border border-transparent underline-offset-4 hover:underline",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-[13px] px-4 py-2.5",
  lg: "text-sm px-5 py-3",
};

export interface ABtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export default function ABtn({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ABtnProps) {
  return (
    <button
      type={rest.type ?? "button"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-sm font-body font-semibold leading-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
