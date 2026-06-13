import { useState, useEffect } from "react";
import { avatarTransformUrl } from "@/lib/supabase";

/**
 * Avatar with graceful fallback to an initial-in-a-circle.
 *
 * Pass the stored object PATH (e.g. `brokers/<id>.webp`) as `photoPath`; the
 * component builds a `size`px Supabase transform URL so we ship a tiny image,
 * not the full upload. If there's no path — or the image fails to load — it
 * renders the initials box (so borrowers, who have no photo, and any load
 * failure both degrade cleanly). Plain <img> by design: Supabase transform
 * URLs don't need next/image, so no remotePatterns config is required.
 */
export default function Avatar({
  name,
  photoPath,
  size = 40,
  version,
  className = "",
}: {
  name?: string | null;
  photoPath?: string | null;
  size?: number;
  /** Cache-buster (e.g. broker.updatedAt) so a replaced photo isn't stale. */
  version?: string | number | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = photoPath ? avatarTransformUrl(photoPath, size * 2, version) : null; // 2x for retina
  // Retry when the URL changes (e.g. photo replaced → new version) instead of
  // staying stuck on the fallback from a prior load error.
  useEffect(() => setFailed(false), [url]);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  const box = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`;
  const dims = { width: size, height: size };

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ? `${name}` : "Avatar"}
        width={size}
        height={size}
        style={dims}
        onError={() => setFailed(true)}
        className={`${box} object-cover bg-cream-200`}
      />
    );
  }

  return (
    <span
      style={dims}
      aria-hidden="true"
      className={`${box} bg-forest-100 font-display text-forest-700`}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
    </span>
  );
}
