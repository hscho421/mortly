import prisma from "./prisma";

/**
 * Generates a unique 9-digit public ID for a user.
 * Retries up to 10 times if a collision is found.
 */
export async function generatePublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = String(Math.floor(100000000 + Math.random() * 900000000));
    const existing = await prisma.user.findUnique({
      where: { publicId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique public ID");
}

/**
 * Generates a unique 9-digit public ID for a borrower request.
 * Retries up to 10 times if a collision is found.
 */
export async function generateRequestPublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = String(Math.floor(100000000 + Math.random() * 900000000));
    const existing = await prisma.borrowerRequest.findUnique({
      where: { publicId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique request public ID");
}
