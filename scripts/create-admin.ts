/**
 * First-ADMIN bootstrap for production.
 *
 * /api/admin/users/create requires an existing admin session, and the seed's
 * admin user only exists in mock mode — so a fresh production database has no
 * way to mint its first admin. This script is that path. Run it once against
 * the production DATABASE_URL, then create further admins through the app.
 *
 * Usage:
 *   ADMIN_EMAIL=ops@mortly.ca ADMIN_PASSWORD='<strong password>' \
 *   ADMIN_NAME='Mortly Ops' npx tsx scripts/create-admin.ts
 *
 * Idempotent: if a user with ADMIN_EMAIL exists, it is promoted to ADMIN
 * (and its password is left untouched) instead of creating a duplicate.
 */
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { generatePublicId } from "../lib/publicId";
import { normalizeEmail } from "../lib/normalizeEmail";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email) {
    throw new Error("ADMIN_EMAIL is required");
  }

  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalized } });

  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`${normalized} is already an ADMIN — nothing to do.`);
      return;
    }
    // Promote in place; bump tokenVersion so any live sessions pick up the
    // new role from a fresh sign-in rather than a stale JWT.
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", tokenVersion: { increment: 1 } },
    });
    console.log(`Promoted existing user ${normalized} to ADMIN.`);
    return;
  }

  if (!password || password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD of at least 12 characters is required when creating a new admin user",
    );
  }

  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      name,
      // Admin accounts are created by an operator with a known-good address;
      // requiring the 6-digit email verification here would just lock the
      // bootstrap account out of login on a fresh deploy with no admin to fix it.
      emailVerified: true,
      publicId: await generatePublicId(),
    },
  });

  console.log(`Created ADMIN ${user.email} (publicId ${user.publicId}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
