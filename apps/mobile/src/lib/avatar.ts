const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/^http:\/\//, "https://");
const AVATAR_BUCKET = "avatars";

/**
 * Public URL for a stored avatar path (the `avatars` bucket is public — matches
 * the web's avatarPublicUrl). Returns null when unconfigured or no path, so the
 * Avatar component falls back to initials. `version` (e.g. the broker's
 * updatedAt) busts the CDN cache when a photo is replaced.
 */
export function avatarUrl(path?: string | null, version?: string | number | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path; // already a full URL
  if (!SUPABASE_URL) return null;
  const base = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
  return version != null ? `${base}?v=${encodeURIComponent(String(version))}` : base;
}
