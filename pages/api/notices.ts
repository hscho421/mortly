import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    try {
      const notices = await prisma.adminNotice.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          subject: true,
          body: true,
          read: true,
          createdAt: true,
        },
      });
      return res.status(200).json(notices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { id } = req.body;
      if (typeof id !== "string" || id.length === 0 || id.length > 100) {
        return res.status(400).json({ error: "Notice id is required" });
      }

      await prisma.adminNotice.updateMany({
        where: { id, userId: session.user.id },
        data: { read: true },
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error marking notice read:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
