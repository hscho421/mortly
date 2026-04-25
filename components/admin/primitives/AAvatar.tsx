interface AAvatarProps {
  size?: number;
  initials?: string;
  tone?: string;
  className?: string;
}

export default function AAvatar({
  size = 36,
  initials,
  tone,
  className = "",
}: AAvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 rounded-full border border-cream-300 font-display font-medium text-forest-800 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: tone ?? "var(--cream-200, #f0eeea)",
      }}
    >
      {initials || "•"}
    </div>
  );
}
