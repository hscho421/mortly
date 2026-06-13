import { useState, useEffect } from "react";
import { avatarTransformUrl } from "@/lib/supabase";

interface AAvatarProps {
  size?: number;
  initials?: string;
  tone?: string;
  /** Stored avatar object path (broker photos). Falls back to initials. */
  photoPath?: string | null;
  /** Cache-buster (e.g. broker.updatedAt). */
  version?: string | number | null;
  className?: string;
}

export default function AAvatar({
  size = 36,
  initials,
  tone,
  photoPath,
  version,
  className = "",
}: AAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = photoPath ? avatarTransformUrl(photoPath, size * 2, version) : null;
  // Retry on URL change (e.g. photo replaced) instead of staying on fallback.
  useEffect(() => setFailed(false), [url]);

  const base = `inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full border border-cream-300 font-display font-medium text-forest-800 ${className}`;

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={initials || "avatar"}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`${base} object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={base}
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
