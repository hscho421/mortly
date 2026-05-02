import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, borrowerSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBorrowerRequest, makeConversation } from "@/tests/fixtures/requests";
import { makeBroker } from "@/tests/fixtures/users";

import handler from "@/pages/api/requests/[id]";

describe("/api/requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(borrowerSession());
  });

  describe("GET", () => {
    it("returns 404 when request doesn't exist", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(null);
      const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
      await handler(req, res);
      expect(res.statusCode).toBe(404);
    });

    it("forbids a different borrower from reading the request", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue({
        ...makeBorrowerRequest({ borrowerId: "other_user" }),
        conversations: [],
      } as never);
      const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    it("strips competitor broker conversations when broker reads", async () => {
      setSession(brokerSession());
      prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ id: "broker_1" }));
      prismaMock.borrowerRequest.findUnique.mockResolvedValue({
        ...makeBorrowerRequest({ status: "OPEN" }),
        conversations: [
          { ...makeConversation({ brokerId: "broker_1" }), _count: { messages: 1 }, broker: {} },
          { ...makeConversation({ id: "conv_2", brokerId: "broker_other" }), _count: { messages: 1 }, broker: {} },
        ],
      } as never);

      const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const body = jsonBody<{ conversations: Array<{ brokerId: string }> }>(res);
      expect(body.conversations).toHaveLength(1);
      expect(body.conversations[0].brokerId).toBe("broker_1");
    });

    it("rejects broker read on a CLOSED request they have no conversation in", async () => {
      setSession(brokerSession());
      prismaMock.broker.findUnique.mockResolvedValue(makeBroker({ id: "broker_1" }));
      prismaMock.borrowerRequest.findUnique.mockResolvedValue({
        ...makeBorrowerRequest({ status: "CLOSED" }),
        conversations: [
          { ...makeConversation({ brokerId: "broker_other" }), _count: { messages: 1 }, broker: {} },
        ],
      } as never);

      const { req, res } = makeReqRes({ method: "GET", query: { id: "300000001" } });
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT (close)", () => {
    it("closes the request + all active conversations + posts system message", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "OPEN" })
      );
      prismaMock.conversation.findMany.mockResolvedValue([
        makeConversation({ id: "conv_1" }),
        makeConversation({ id: "conv_2" }),
      ] as never);
      prismaMock.borrowerRequest.update.mockResolvedValue(
        makeBorrowerRequest({ status: "CLOSED" })
      );
      prismaMock.message.create.mockResolvedValue({ id: "m" } as never);
      prismaMock.conversation.updateMany.mockResolvedValue({ count: 2 } as never);

      const { req, res } = makeReqRes({
        method: "PUT",
        query: { id: "300000001" },
        body: { status: "CLOSED" },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // System-close message fanned out to each active conversation
      expect(prismaMock.message.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.conversation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "CLOSED" },
          where: expect.objectContaining({ status: "ACTIVE" }),
        })
      );
    });

    it("rejects status values other than CLOSED", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(makeBorrowerRequest());
      const { req, res } = makeReqRes({
        method: "PUT",
        query: { id: "300000001" },
        body: { status: "OPEN" },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("forbids non-owning borrower", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ borrowerId: "someone_else" })
      );
      const { req, res } = makeReqRes({
        method: "PUT",
        query: { id: "300000001" },
        body: { status: "CLOSED" },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE", () => {
    it("refuses to delete an IN_PROGRESS or CLOSED request", async () => {
      for (const status of ["IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"] as const) {
        vi.clearAllMocks();
        prismaMock.borrowerRequest.findUnique.mockResolvedValue(makeBorrowerRequest({ status }));
        const { req, res } = makeReqRes({ method: "DELETE", query: { id: "300000001" } });
        await handler(req, res);
        expect(res.statusCode).toBe(400);
      }
    });

    it("hard-deletes an OPEN request that has zero conversations", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "OPEN", _count: { conversations: 0 } }) as never,
      );
      prismaMock.borrowerRequest.delete.mockResolvedValue(makeBorrowerRequest() as never);

      const { req, res } = makeReqRes({ method: "DELETE", query: { id: "300000001" } });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(prismaMock.borrowerRequest.delete).toHaveBeenCalledOnce();
    });

    it("blocks hard-delete when conversations exist (brokers paid for them)", async () => {
      // Refusing the delete is the security-fix: previously the cascade wiped
      // chats brokers had spent credits on. Borrower must close (PUT) instead
      // so history is preserved.
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "OPEN", _count: { conversations: 3 } }) as never,
      );

      const { req, res } = makeReqRes({ method: "DELETE", query: { id: "300000001" } });
      await handler(req, res);

      expect(res.statusCode).toBe(409);
      expect(prismaMock.borrowerRequest.delete).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("allows editing an OPEN request", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "OPEN" })
      );
      prismaMock.borrowerRequest.update.mockResolvedValue(makeBorrowerRequest());

      const { req, res } = makeReqRes({
        method: "PATCH",
        query: { id: "300000001" },
        body: { notes: "Updated notes" },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(prismaMock.borrowerRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: "Updated notes" }) })
      );
    });

    it("refuses to edit a CLOSED request", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "CLOSED" })
      );
      const { req, res } = makeReqRes({
        method: "PATCH",
        query: { id: "300000001" },
        body: { notes: "Too late" },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("rejects product types that don't match the category", async () => {
      prismaMock.borrowerRequest.findUnique.mockResolvedValue(
        makeBorrowerRequest({ status: "OPEN", mortgageCategory: "RESIDENTIAL" })
      );
      const { req, res } = makeReqRes({
        method: "PATCH",
        query: { id: "300000001" },
        body: { productTypes: ["COMM_NEW_LOAN"] },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    });
  });
});
