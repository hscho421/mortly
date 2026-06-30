import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import {
  getSupabaseAdmin,
  AVATAR_BUCKET,
  brokerAvatarPath,
  avatarPublicUrl,
} from "@/lib/supabaseAdmin";

// The client resizes avatars to a 512×512 WebP (~tens of KB); 1MB is a generous
// ceiling that still blocks an attacker padding a non-image payload.
const MAX_AVATAR_BYTES = 1024 * 1024;

/**
 * POST   /api/brokers/avatar  — confirm an upload: persist the object path on
 *                               Broker.profilePhoto. The client calls this
 *                               after a successful direct-to-storage upload.
 * DELETE /api/brokers/avatar  — remove the avatar object + clear the field.
 *
 * The path is always recomputed server-side from the session user id, so a
 * broker can only ever point their own profilePhoto at their own object —
 * the client never supplies an arbitrary path/URL.
 */
export default withAuth(
  async (req, res, session) => {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    const path = brokerAvatarPath(session.user.id);

    if (req.method === "POST") {
      // Verify the just-uploaded object before trusting it. The signed-upload URL
      // pins neither content-type nor size, so a client could write HTML/SVG (or
      // nothing) to its own avatar path — and the bucket is public-read, so that
      // content would be served from our storage domain (phishing/malware under
      // our brand). Gate on the stored object's metadata via the service-role
      // client; reject (and clean up) anything that isn't a small JPEG.
      const verifier = getSupabaseAdmin();
      if (verifier) {
        const fileName = `${session.user.id}.jpg`;
        const { data: objects, error: listErr } = await verifier.storage
          .from(AVATAR_BUCKET)
          .list("brokers", { search: fileName, limit: 1 });
        if (listErr) {
          console.error("avatar verify failed:", listErr);
          return res
            .status(502)
            .json({ error: "Could not verify the upload. Please try again." });
        }
        const obj = objects?.find((o: { name: string }) => o.name === fileName);
        const meta = (obj?.metadata ?? null) as { mimetype?: string; size?: number } | null;
        if (!obj || !meta) {
          return res.status(400).json({
            error: "No uploaded image found. Please try uploading again.",
            code: "UPLOAD_MISSING",
          });
        }
        if (meta.mimetype !== "image/jpeg") {
          await verifier.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
          return res.status(400).json({
            error: "Profile photo must be a JPEG image.",
            code: "INVALID_IMAGE_TYPE",
          });
        }
        if (typeof meta.size === "number" && meta.size > MAX_AVATAR_BYTES) {
          await verifier.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
          return res.status(400).json({
            error: "Profile photo is too large.",
            code: "IMAGE_TOO_LARGE",
          });
        }
      }

      // Trust only the server-derived path. We store the object PATH (not a
      // full URL) so it survives project/domain changes; URL is built at read.
      const updated = await prisma.broker.update({
        where: { userId: session.user.id },
        data: { profilePhoto: path },
        select: { profilePhoto: true },
      });
      return res.status(200).json({
        profilePhoto: updated.profilePhoto,
        url: avatarPublicUrl(path),
      });
    }

    if (req.method === "DELETE") {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { error } = await admin.storage.from(AVATAR_BUCKET).remove([path]);
        // Non-fatal: the row is the source of truth for the UI; a leftover
        // object (if removal fails) is harmless and overwritten on re-upload.
        if (error) console.error("avatar object remove failed:", error);
      }
      await prisma.broker.update({
        where: { userId: session.user.id },
        data: { profilePhoto: null },
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  { roles: ["BROKER"] },
);
