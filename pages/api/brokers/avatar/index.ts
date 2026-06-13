import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import {
  getSupabaseAdmin,
  AVATAR_BUCKET,
  brokerAvatarPath,
  avatarPublicUrl,
} from "@/lib/supabaseAdmin";

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
