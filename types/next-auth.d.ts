import { DefaultSession } from "next-auth";
import type { Role, UserStatus } from "@prisma/client";

/**
 * Augment NextAuth's Session + JWT with the fields our app actually
 * carries. This is the single source of truth — every consumer should be
 * able to read `session.user.role` etc. without `as any` casts.
 *
 * `tokenVersion` and `status` are embedded so the session callback can do
 * its server-side revocation check on every read (see `lib/auth.ts`).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      publicId: string;
      role: Role;
      needsRoleSelection?: boolean;
      needsNameEntry?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    publicId: string;
    role: Role;
    needsRoleSelection?: boolean;
    needsNameEntry?: boolean;
    tokenVersion?: number;
    status?: UserStatus;
  }
}
