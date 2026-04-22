import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import {
  generatePublicId,
  generateRequestPublicId,
  generateConversationPublicId,
} from "@/lib/publicId";

describe("generatePublicId (user)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 9-digit numeric string", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const id = await generatePublicId();
    expect(id).toMatch(/^\d{9}$/);
    expect(prismaMock.user.findUnique).toHaveBeenCalledOnce();
  });

  it("retries when first candidate collides and succeeds on the next", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: "existing" } as never)
      .mockResolvedValueOnce(null);
    const id = await generatePublicId();
    expect(id).toMatch(/^\d{9}$/);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("throws after 10 consecutive collisions", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "always-exists" } as never);
    await expect(generatePublicId()).rejects.toThrow(/Failed to generate/);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(10);
  });
});

describe("generateRequestPublicId / generateConversationPublicId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to the correct Prisma model", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(null);
    const rid = await generateRequestPublicId();
    expect(rid).toMatch(/^\d{9}$/);

    prismaMock.conversation.findUnique.mockResolvedValue(null);
    const cid = await generateConversationPublicId();
    expect(cid).toMatch(/^\d{9}$/);
  });
});
