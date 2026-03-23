import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const broker = await prisma.broker.findUnique({
        where: { userId: session.user.id },
        include: {
          user: {
            select: { id: true, publicId: true, name: true, email: true },
          },
          subscription: true,
        },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker profile not found" });
      }

      return res.status(200).json(broker);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BROKER") {
        return res.status(403).json({ error: "Only broker users can create a broker profile" });
      }

      const existing = await prisma.broker.findUnique({
        where: { userId: session.user.id },
      });

      if (existing) {
        return res.status(409).json({ error: "Broker profile already exists" });
      }

      const { brokerageName, province, licenseNumber, phone, ...rest } = req.body;

      if (!brokerageName || !province || !licenseNumber || !phone) {
        return res.status(400).json({
          error: "brokerageName, province, licenseNumber, and phone are required",
        });
      }

      const broker = await prisma.broker.create({
        data: {
          userId: session.user.id,
          brokerageName,
          province,
          licenseNumber,
          phone,
          ...rest,
        },
      });

      return res.status(201).json(broker);
    }

    if (req.method === "PUT") {
      const broker = await prisma.broker.findUnique({
        where: { userId: session.user.id },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker profile not found" });
      }

      const {
        brokerageName,
        province,
        licenseNumber,
        phone,
        bio,
        yearsExperience,
        areasServed,
        specialties,
        profilePhoto,
        mortgageCategory,
      } = req.body;

      const safeData: Record<string, unknown> = {};
      if (brokerageName !== undefined) safeData.brokerageName = brokerageName;
      if (province !== undefined) safeData.province = province;
      if (licenseNumber !== undefined) safeData.licenseNumber = licenseNumber;
      if (phone !== undefined) safeData.phone = phone;
      if (bio !== undefined) safeData.bio = bio;
      if (yearsExperience !== undefined) safeData.yearsExperience = yearsExperience;
      if (areasServed !== undefined) safeData.areasServed = areasServed;
      if (specialties !== undefined) safeData.specialties = specialties;
      if (profilePhoto !== undefined) safeData.profilePhoto = profilePhoto;
      if (mortgageCategory !== undefined) safeData.mortgageCategory = mortgageCategory;

      const updated = await prisma.broker.update({
        where: { userId: session.user.id },
        data: safeData,
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/brokers/profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
