import prisma from "@/lib/prisma";
import { validateProductTypes } from "@/lib/requestConfig";
import { withAuth } from "@/lib/withAuth";
import { assertOptionalString, assertOptionalBoundedJson, ValidationError } from "@/lib/validate";

export default withAuth(async (req, res, session) => {
  const { id: publicId } = req.query;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    // Look up by publicId or fall back to internal id for backwards compatibility
    const lookup = /^\d{9}$/.test(publicId)
      ? { publicId }
      : { id: publicId };

    if (req.method === "GET") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
        include: {
          _count: {
            select: { conversations: true },
          },
          conversations: {
            select: {
              id: true,
              createdAt: true,
              status: true,
              brokerId: true,
              broker: {
                select: {
                  id: true,
                  userId: true,
                  brokerageName: true,
                  verificationStatus: true,
                  yearsExperience: true,
                  specialties: true,
                  bio: true,
                  user: {
                    select: { id: true, publicId: true, name: true, email: true },
                  },
                },
              },
              _count: { select: { messages: true } },
            },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (session.user.role === "BORROWER" && request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker || broker.verificationStatus !== "VERIFIED") {
          return res.status(403).json({ error: "Broker must be verified to view requests" });
        }
        if (request.status !== "OPEN") {
          const hasConversation = request.conversations.some(
            (conv: { brokerId: string }) => conv.brokerId === broker.id
          );
          if (!hasConversation) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        // Strip competitor conversations — broker should only see their own
        request.conversations = request.conversations.filter(
          (conv: { brokerId: string }) => conv.brokerId === broker.id
        );
      }

      return res.status(200).json(request);
    }

    if (req.method === "PUT") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can update this request" });
      }

      const { status } = req.body;

      if (status !== "CLOSED") {
        return res.status(400).json({ error: "Only status CLOSED is allowed" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedReq = await tx.borrowerRequest.update({
          where: { id: request.id },
          data: { status },
        });

        const activeConversations = await tx.conversation.findMany({
          where: { requestId: request.id, status: "ACTIVE" },
          select: { id: true },
        });

        if (activeConversations.length > 0) {
          for (const convo of activeConversations) {
            await tx.message.create({
              data: {
                conversationId: convo.id,
                senderId: session.user.id,
                isSystem: true,
                body: "This request has been closed. / 이 요청이 종료되었습니다.",
              },
            });
          }

          await tx.conversation.updateMany({
            where: { requestId: request.id, status: "ACTIVE" },
            data: { status: "CLOSED" },
          });
        }

        return updatedReq;
      });

      return res.status(200).json(updated);
    }

    if (req.method === "PATCH") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
        include: { _count: { select: { conversations: true } } },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can edit this request" });
      }

      if (request.status !== "OPEN" && request.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Can only edit requests with OPEN or PENDING_APPROVAL status" });
      }

      const {
        mortgageCategory,
        productTypes,
        province,
        city,
        details,
        desiredTimeline,
        notes,
      } = req.body;

      // Lock down material edits once any broker has spent a credit on this
      // request. Allowing a borrower to swap "$1M residential, Toronto" → "$50K
      // commercial, rural BC" after brokers paid to message would defraud
      // them. Cosmetic edits (notes, desiredTimeline) stay open so the
      // borrower can clarify.
      const hasConversations = request._count.conversations > 0;
      if (hasConversations) {
        const onlyCosmetic =
          mortgageCategory === undefined &&
          productTypes === undefined &&
          province === undefined &&
          city === undefined &&
          details === undefined;
        if (!onlyCosmetic) {
          return res.status(409).json({
            error:
              "This request has active conversations — only notes and desired timeline can be updated. Close the request and create a new one for material changes.",
          });
        }
      }

      // Validate product types if provided
      if (productTypes) {
        const cat = mortgageCategory || request.mortgageCategory;
        if (!validateProductTypes(cat, productTypes)) {
          return res.status(400).json({ error: "Invalid product type for selected category" });
        }
        if (!Array.isArray(productTypes) || productTypes.length === 0 || productTypes.length > 20) {
          return res.status(400).json({ error: "Invalid productTypes" });
        }
      }

      // Bounded validation on the user-controlled string/JSON fields.
      const validatedProvince = province !== undefined
        ? assertOptionalString(province, "province", { max: 100 })
        : undefined;
      const validatedCity = city !== undefined
        ? assertOptionalString(city, "city", { max: 100 })
        : undefined;
      const validatedTimeline = desiredTimeline !== undefined
        ? assertOptionalString(desiredTimeline, "desiredTimeline", { max: 200 })
        : undefined;
      const validatedNotes = notes !== undefined
        ? assertOptionalString(notes, "notes", { max: 4000 })
        : undefined;
      const validatedDetails = details !== undefined
        ? assertOptionalBoundedJson(details, "details", 4096)
        : undefined;

      const updated = await prisma.borrowerRequest.update({
        where: { id: request.id },
        data: {
          ...(mortgageCategory && { mortgageCategory }),
          ...(productTypes && { productTypes }),
          ...(validatedProvince !== undefined && { province: validatedProvince ?? request.province }),
          ...(city !== undefined && { city: validatedCity }),
          ...(validatedDetails !== undefined && { details: validatedDetails }),
          ...(desiredTimeline !== undefined && { desiredTimeline: validatedTimeline }),
          ...(notes !== undefined && { notes: validatedNotes }),
        },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
        include: { _count: { select: { conversations: true } } },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can delete this request" });
      }

      if (request.status !== "OPEN" && request.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Can only delete requests with OPEN or PENDING_APPROVAL status" });
      }

      // Hard-delete is forbidden once brokers have spent credits to message
      // this request — otherwise we'd silently destroy chats they paid for.
      // Borrower can still close (PUT status=CLOSED) which keeps history.
      if (request._count.conversations > 0) {
        return res.status(409).json({
          error:
            "Cannot delete a request that has conversations. Close the request instead to keep history intact.",
        });
      }

      await prisma.borrowerRequest.delete({
        where: { id: request.id },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error("Error in /api/requests/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

