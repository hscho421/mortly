import { hash, compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              borrowerRequests: true,
              conversations: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Get borrower profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // PUT - update profile
  if (req.method === "PUT") {
    try {
      const { name, currentPassword, newPassword } = req.body;

      const updateData: Record<string, unknown> = {};

      // Update name
      if (name !== undefined) {
        if (!name || typeof name !== "string" || name.trim().length === 0) {
          return res.status(400).json({ message: "Name cannot be empty" });
        }
        updateData.name = name.trim();
      }

      // Change password
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }

        if (newPassword.length < 8) {
          return res.status(400).json({ message: "New password must be at least 8 characters" });
        }

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { passwordHash: true },
        });

        if (!user || !user.passwordHash) {
          return res.status(400).json({ message: "Password change not available for this account" });
        }

        const isValid = await compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }

        updateData.passwordHash = await hash(newPassword, 12);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No changes provided" });
      }

      // Bump tokenVersion on password change so every other JWT for this
      // account stops working. Without this, a stolen token survives the
      // user's password rotation for the full session lifetime.
      const passwordChanged = "passwordHash" in updateData;
      if (passwordChanged) {
        (updateData as Record<string, unknown>).tokenVersion = { increment: 1 };
      }

      const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: { id: true, name: true, email: true },
      });

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Update borrower profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});

