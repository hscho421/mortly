import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  if (req.method === "GET") {
    const notices = await prisma.adminNotice.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        admin: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, publicId: true, name: true, email: true } },
      },
    });
    return res.status(200).json(notices);
  }

  if (req.method === "POST") {
    const { userId, subject, body } = req.body;

    if (!userId || !subject || !body) {
      return res.status(400).json({ error: "userId, subject, and body are required" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, publicId: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const notice = await prisma.adminNotice.create({
      data: {
        adminId: session.user.id,
        userId,
        subject,
        body,
      },
      include: {
        admin: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, publicId: true, name: true, email: true } },
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: "SEND_NOTICE",
        targetType: "USER",
        targetId: targetUser.publicId,
        details: JSON.stringify({ subject }),
      },
    });

    return res.status(201).json(notice);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
