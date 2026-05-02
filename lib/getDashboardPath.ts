import type { Role } from "@prisma/client";

/**
 * Single source of truth for "where do I send a logged-in user?".
 *
 * Both Footer and Navbar previously inlined this if/else chain — keeping it
 * here means a future role addition (e.g. "MODERATOR") flips the routing
 * everywhere by editing one file.
 */
export function getDashboardPath(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "BROKER":
      return "/broker/dashboard";
    case "BORROWER":
    default:
      return "/borrower/dashboard";
  }
}
