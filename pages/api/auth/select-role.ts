import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { role } = req.body;
  if (role !== "BORROWER" && role !== "BROKER") {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) || {};
  if (!prefs.needsRoleSelection) {
    return res.status(400).json({ message: "Role already selected" });
  }

  // Remove needsRoleSelection flag and update role
  const restPrefs = { ...prefs };
  delete restPrefs.needsRoleSelection;
  const newPrefs = Object.keys(restPrefs).length > 0 ? JSON.parse(JSON.stringify(restPrefs)) : null;
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      role,
      preferences: newPrefs,
    },
  });

  return res.status(200).json({ success: true, role });
}
