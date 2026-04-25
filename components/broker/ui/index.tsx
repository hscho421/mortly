import React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ── Eyebrow ──
// Small mono-amber overline that precedes every topbar title and section head.
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "font-mono text-[10px] uppercase tracking-[0.18em] text-amber-600",
        className,
      )}
    >
      — {children}
    </div>
  );
}

// ── Card ──
// Sharp 2px corners, cream surface, thin border — matches reference palette A.
export function Card({
  as: Tag = "div",
  padding = "default",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "article";
  padding?: "none" | "sm" | "default" | "lg";
  className?: string;
  children: React.ReactNode;
} & DivProps) {
  const pad =
    padding === "none"
      ? "p-0"
      : padding === "sm"
        ? "p-4"
        : padding === "lg"
          ? "p-7"
          : "p-6";
  return (
    <Tag
      className={cx(
        "rounded-sm border border-cream-300 bg-cream-50",
        pad,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Badge ──
type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "dark";

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<BadgeTone, string> = {
    neutral: "bg-cream-200 text-forest-700 border-cream-300",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-success-50 text-success-700 border-success-100",
    warning: "bg-warning-50 text-warning-700 border-warning-100",
    danger: "bg-error-50 text-error-700 border-error-100",
    info: "bg-info-50 text-info-700 border-info-100",
    dark: "bg-forest-800 text-cream-100 border-forest-800",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border font-mono text-[10px] font-semibold tracking-[0.1em] uppercase",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Button ──
// A single Btn primitive replaces the scattered `.btn-*` utility classes for
// broker surfaces. Backed by Tailwind so it renders in tests without CSS.
type BtnVariant = "primary" | "ghost" | "dark" | "subtle" | "danger";
type BtnSize = "sm" | "md" | "lg";

export const Btn = React.forwardRef<
  HTMLButtonElement,
  {
    variant?: BtnVariant;
    size?: BtnSize;
    as?: "button" | "a";
    href?: string;
    className?: string;
    children: React.ReactNode;
  } & ButtonProps
>(function Btn(
  { variant = "primary", size = "md", as, href, className, children, ...rest },
  ref,
) {
  const sizeClass: Record<BtnSize, string> = {
    sm: "px-3 py-1.5 text-[12px]",
    md: "px-4 py-2.5 text-[13px]",
    lg: "px-6 py-3 text-[14px]",
  };
  const variantClass: Record<BtnVariant, string> = {
    primary:
      "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:border-amber-600",
    dark:
      "bg-forest-800 text-cream-100 border-forest-800 hover:bg-forest-700 hover:border-forest-700",
    ghost:
      "bg-transparent text-forest-800 border-cream-300 hover:bg-cream-200",
    subtle:
      "bg-cream-100 text-forest-800 border-cream-300 hover:bg-cream-200",
    danger:
      "bg-error-500 text-white border-error-500 hover:bg-error-600 hover:border-error-600",
  };
  const classes = cx(
    "inline-flex items-center justify-center gap-1.5 rounded-sm border font-body font-semibold transition-colors duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
    sizeClass[size],
    variantClass[variant],
    className,
  );
  if (as === "a" || href) {
    // Strip `type` since it's not valid on <a>.
    const { type: _buttonType, ...anchorProps } =
      rest as ButtonProps & { type?: string };
    void _buttonType;
    return (
      <a
        href={href}
        className={classes}
        {...(anchorProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }
  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});

// ── StatCard ──
// Editorial stat card: mono overline, serif display number, small trend line.
export function StatCard({
  label,
  value,
  trend,
  accent,
  icon,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  trend?: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-sm border p-6 flex items-start justify-between gap-4",
        accent
          ? "bg-amber-50 border-amber-200"
          : "bg-cream-50 border-cream-300",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
          {label}
        </div>
        <div
          className={cx(
            "mt-2 font-display font-semibold leading-none tracking-tight text-4xl",
            accent ? "text-amber-700" : "text-forest-800",
          )}
        >
          {value}
        </div>
        {trend && (
          <div className="mt-3 font-body text-[11px] text-sage-500">
            {trend}
          </div>
        )}
      </div>
      {icon && (
        <div
          className={cx(
            "rounded-sm p-2.5 shrink-0",
            accent
              ? "bg-amber-100 text-amber-700"
              : "bg-cream-200 text-forest-600",
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

// ── AppTopbar ──
// Per-page topbar: optional eyebrow, serif title, right-aligned actions slot.
// Sticky so users always keep primary page context when scrolling long lists.
export function AppTopbar({
  eyebrow,
  title,
  actions,
  subtitle,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-cream-300 bg-cream-100/95 backdrop-blur-sm px-5 py-4 sm:px-8 sm:py-5">
      <div className="min-w-0 flex-1">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1 font-display font-semibold text-2xl sm:text-3xl leading-tight tracking-tight text-forest-800 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 font-body text-[13px] text-sage-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ── SectionHead ──
// Section title inside content area — eyebrow + serif heading + optional right slot.
export function SectionHead({
  eyebrow,
  title,
  right,
  size = "md",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <div
          className={cx(
            "font-display font-semibold text-forest-800 leading-tight tracking-tight mt-1",
            sz,
          )}
        >
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── EmptyState ──
export function EmptyState({
  title,
  body,
  cta,
  glyph = "◌",
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  cta?: React.ReactNode;
  glyph?: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-dashed border-cream-300 bg-cream-50 px-6 py-12 text-center">
      <div className="font-display text-3xl text-sage-400">{glyph}</div>
      <div className="mt-3 font-display font-semibold text-lg text-forest-800">
        {title}
      </div>
      {body && (
        <p className="mt-2 mx-auto max-w-sm font-body text-[13px] text-sage-500">
          {body}
        </p>
      )}
      {cta && <div className="mt-5 flex justify-center">{cta}</div>}
    </div>
  );
}
