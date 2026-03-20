import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = session.user.id;

    // Find all conversations the user is part of
    const conversations = await prisma.conversation.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { borrowerId: userId },
          { broker: { userId } },
        ],
      },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { senderId: true },
        },
      },
    });

    // Count conversations where the last message is NOT from this user
    const unread = conversations.filter(
      (c) => c.messages.length > 0 && c.messages[0].senderId !== userId
    ).length;

    return res.status(200).json({ unread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
