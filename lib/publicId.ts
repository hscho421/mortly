import { randomInt } from "crypto";
import prisma from "./prisma";

/**
 * Generate a uniformly distributed 9-digit public ID using `crypto.randomInt`.
 *
 * Math.random() is V8's predictable PRNG and was previously used here — leaking
 * any handful of generated IDs would let an attacker narrow the keyspace. We
 * use `crypto.randomInt(min, max)` (CSPRNG, exclusive upper bound) to keep IDs
 * unguessable. The 9-digit width is preserved for URL stability.
 */
function nextCandidate(): string {
  return String(randomInt(100_000_000, 1_000_000_000));
}

/** Unique 9-digit public ID for a user. */
export async function generatePublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = nextCandidate();
    const existing = await prisma.user.findUnique({
      where: { publicId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique public ID");
}

/** Unique 9-digit public ID for a borrower request. */
export async function generateRequestPublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = nextCandidate();
    const existing = await prisma.borrowerRequest.findUnique({
      where: { publicId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique request public ID");
}

/** Unique 9-digit public ID for a conversation. */
export async function generateConversationPublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = nextCandidate();
    const existing = await prisma.conversation.findUnique({
      where: { publicId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique conversation public ID");
}
