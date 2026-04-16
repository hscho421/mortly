import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        publicId: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        broker: {
          select: {
            id: true,
            brokerageName: true,
            province: true,
            licenseNumber: true,
            phone: true,
            mortgageCategory: true,
            bio: true,
            yearsExperience: true,
            verificationStatus: true,
            subscriptionTier: true,
            responseCredits: true,
            // Broker-side conversations live on Broker.conversations (brokerId FK),
            // not on User.conversations (which is the borrower-side relation).
            // Surface them here so the admin user-detail page can render
            // conversations for broker users.
            conversations: {
              take: 10,
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                publicId: true,
                status: true,
                updatedAt: true,
                _count: { select: { messages: true } },
                broker: { select: { id: true, user: { select: { name: true, email: true } } } },
                borrower: { select: { id: true, name: true, email: true } },
                request: { select: { id: true, province: true, mortgageCategory: true } },
              },
            },
            _count: { select: { conversations: true } },
          },
        },
        borrowerRequests: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            publicId: true,
            province: true,
            city: true,
            status: true,
            mortgageCategory: true,
            productTypes: true,
            details: true,
            desiredTimeline: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        conversations: {
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            publicId: true,
            status: true,
            updatedAt: true,
            _count: { select: { messages: true } },
            broker: { select: { id: true, user: { select: { name: true, email: true } } } },
            borrower: { select: { id: true, name: true, email: true } },
            request: { select: { id: true, province: true, mortgageCategory: true } },
          },
        },
        _count: {
          select: {
            borrowerRequests: true,
            conversations: true,
            reports: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  }

  if (req.method === "PUT") {
    const { status } = req.body;

    const validStatuses = ["ACTIVE", "SUSPENDED", "BANNED"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use ACTIVE, SUSPENDED, or BANNED." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent admins from suspending/banning other admins
    if (user.role === "ADMIN" && status !== "ACTIVE") {
      return res.status(403).json({ error: "Cannot suspend or ban admin accounts." });
    }

    // Prevent self-suspension
    if (user.id === session.user.id) {
      return res.status(403).json({ error: "Cannot change your own account status." });
    }

    const actionMap: Record<string, string> = {
      SUSPENDED: "SUSPEND_USER",
      BANNED: "BAN_USER",
      ACTIVE: "REACTIVATE_USER",
    };

    const { reason } = req.body;

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      }),
      prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: actionMap[status],
          targetType: "USER",
          targetId: user.publicId,
          details: JSON.stringify({ previousStatus: user.status, newStatus: status }),
          reason: reason || null,
        },
      }),
    ]);

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
