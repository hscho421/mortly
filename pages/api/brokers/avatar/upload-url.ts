import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import {
  getSupabaseAdmin,
  AVATAR_BUCKET,
  brokerAvatarPath,
} from "@/lib/supabaseAdmin";

/**
 * POST /api/brokers/avatar/upload-url
 *
 * Mints a short-lived, path-scoped Supabase signed upload URL so the browser
 * can upload the resized avatar DIRECTLY to Storage (the bytes never pass
 * through this serverless function — Vercel caps bodies ~4.5MB). Only a
 * VERIFIED broker may request one, and the path is deterministic per user
 * (brokers/<userId>.webp), so a broker can only ever write their own avatar.
 */
export default withAuth(
  async (req, res, session) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "Avatar uploads are not configured" });
    }

    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { verificationStatus: true },
    });
    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }
    // PENDING brokers may set a photo (so they can complete their profile right
    // after onboarding). It stays invisible to borrowers until verified —
    // borrowers only ever see brokers who've started conversations, which
    // requires VERIFIED — and admins review it during verification. Only
    // REJECTED accounts are blocked.
    if (broker.verificationStatus === "REJECTED") {
      return res
        .status(403)
        .json({ error: "This account cannot set a profile photo", code: "REJECTED" });
    }

    const path = brokerAvatarPath(session.user.id);
    const { data, error } = await admin.storage
      .from(AVATAR_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      console.error("createSignedUploadUrl failed:", error);
      return res.status(502).json({ error: "Could not start the upload. Please try again." });
    }

    // token + path are what the client passes to supabase.storage.uploadToSignedUrl(...)
    return res.status(200).json({ path: data.path, token: data.token, signedUrl: data.signedUrl });
  },
  { roles: ["BROKER"] },
);
