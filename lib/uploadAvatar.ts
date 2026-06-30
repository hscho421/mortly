import { supabase, AVATAR_BUCKET, avatarPublicUrl } from "@/lib/supabase";

/**
 * Run the broker avatar upload flow for an already-resized JPEG blob:
 *   1. ask our API for a path-scoped signed upload URL
 *   2. upload the blob directly to Supabase Storage
 *   3. confirm — persist the object path on the broker row
 *
 * Requires the broker row to already exist (the endpoints gate on it). Throws
 * on any step so callers can surface an error; returns the public URL + path.
 * Shared by the broker profile page and onboarding (deferred upload).
 */
export async function uploadBrokerAvatar(
  blob: Blob,
): Promise<{ path: string; url: string | null }> {
  const urlRes = await fetch("/api/brokers/avatar/upload-url", { method: "POST" });
  if (!urlRes.ok) {
    const d = await urlRes.json().catch(() => ({}));
    throw new Error(d.error || "Could not start the upload");
  }
  const { path, token } = await urlRes.json();

  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg" });
  if (upErr) throw new Error("Upload failed");

  const confirmRes = await fetch("/api/brokers/avatar", { method: "POST" });
  if (!confirmRes.ok) throw new Error("Upload failed");
  const data = await confirmRes.json().catch(() => ({}));

  return { path, url: data.url ?? avatarPublicUrl(path) };
}
