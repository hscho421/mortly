/**
 * First-ADMIN bootstrap for a fresh production database.
 *
 * /api/admin/users/create requires an existing admin session, and the seed's
 * admin user only exists in mock mode — so a freshly-reset prod DB has no way
 * to mint its first admin. This script is that path. Run it ONCE against the
 * production DATABASE_URL, then create any further admins from inside the app
 * (Admin → People → New admin), which also emails the existing admin cohort.
 *
 * Usage (reads .env / .env.local automatically, like the other scripts):
 *   ADMIN_EMAIL=ops@mortly.ca ADMIN_PASSWORD='a-strong-password' \
 *   ADMIN_NAME='Mortly Ops' npm run create:admin
 *
 * Idempotent: if a user with ADMIN_EMAIL already exists it is promoted to
 * ADMIN (its password is left untouched) instead of creating a duplicate.
 *
 * Self-contained on purpose — it owns its PrismaClient and generates the
 * public ID inline so importing the lib singletons (which connect at import,
 * before env is loaded) can't break the bootstrap. Uses the pooled
 * DATABASE_URL; no migrations run here.
 *
 * Exit codes: 0 = created/promoted/no-op, 1 = bad input or failure.
 */
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeEmail, isValidEmail } from "../lib/normalizeEmail";

// tsx doesn't read .env; load it (Node 20.12+) before instantiating Prisma so
// the connection string is present. Skipped if DATABASE_URL is already set.
function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof loader !== "function") return;
  for (const file of [".env.local", ".env"]) {
    try {
      loader.call(process, file);
      if (process.env.DATABASE_URL) return;
    } catch {
      /* file absent — try the next one */
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

/** Unique 9-digit public ID — mirrors lib/publicId.generatePublicId. */
async function generatePublicId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = String(randomInt(100_000_000, 1_000_000_000));
    const existing = await prisma.user.findUnique({ where: { publicId: id }, select: { id: true } });
    if (!existing) return id;
  }
  throw new Error("Failed to generate a unique public ID");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (no .env found and none exported)");
  }

  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!rawEmail || !isValidEmail(rawEmail)) {
    throw new Error("ADMIN_EMAIL is required and must be a valid email address");
  }
  const email = normalizeEmail(rawEmail);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`✓ ${email} is already an ADMIN — nothing to do.`);
      return;
    }
    // Promote in place; bump tokenVersion so any live session must re-auth to
    // pick up the new role rather than trusting a stale JWT.
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", tokenVersion: { increment: 1 } },
    });
    console.log(`✓ Promoted existing user ${email} to ADMIN.`);
    return;
  }

  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD of at least 12 characters is required to create a new admin");
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      name,
      // Created by a trusted operator against a known-good address. Requiring
      // the 6-digit email verification here would lock the very first admin out
      // of a fresh deploy (there'd be no admin to unblock them).
      emailVerified: true,
      publicId: await generatePublicId(),
    },
  });

  console.log(`✓ Created ADMIN ${user.email} (publicId ${user.publicId}).`);
}

main()
  .catch((err) => {
    console.error("✗", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
