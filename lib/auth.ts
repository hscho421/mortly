import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { generatePublicId } from "./publicId";
import { CURRENT_LEGAL_VERSION, createLegalAcceptanceMetadata } from "./legal";
import { normalizeEmail } from "./normalizeEmail";
import { SESSION_DB_CACHE_TTL_MS } from "./constants";

/**
 * Per-user session-revalidation cache. The session callback fires on every
 * SSR page render and every getSession() round-trip — without caching it
 * was hitting Postgres on each request. 5s TTL keeps the revocation lag
 * acceptable while reducing DB reads ~99% for active users.
 *
 * Lives in module scope (per-lambda). Across-instance staleness is bounded
 * by the same 5s window. Acceptable for revocation: when an admin suspends
 * a user, the longest the user can keep using their JWT is 5s.
 */
interface SessionDbCacheEntry {
  tokenVersion: number;
  status: import("@prisma/client").UserStatus;
  role: import("@prisma/client").Role;
  publicId: string;
  expiresAt: number;
}
const sessionDbCache = new Map<string, SessionDbCacheEntry>();

/**
 * Bump a user's `tokenVersion`. Every existing JWT for the user becomes
 * invalid the next time it round-trips through the `session` callback.
 * Call this from:
 *   - password change
 *   - admin SUSPEND / BAN
 *   - account deletion
 *   - "log out everywhere" (future)
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  // Drop the local session-revalidation cache so this lambda picks up the
  // bump on the next session read. Other warm lambdas converge within the
  // 5s TTL window — acceptable revocation lag.
  sessionDbCache.delete(userId);
}

export function createAuthOptions(acceptedLegalVersion?: string | null): NextAuthOptions {
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_PRIVATE_KEY
        ? [
            AppleProvider({
              clientId: process.env.APPLE_CLIENT_ID,
              clientSecret: process.env.APPLE_PRIVATE_KEY,
            }),
          ]
        : []),
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required");
          }

          const email = normalizeEmail(credentials.email);
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            throw new Error("Invalid email or password");
          }

          if (!user.passwordHash) {
            throw new Error("GOOGLE_ACCOUNT");
          }

          const isValid = await compare(credentials.password, user.passwordHash);
          if (!isValid) {
            throw new Error("Invalid email or password");
          }

          if (!user.emailVerified) {
            throw new Error("EMAIL_NOT_VERIFIED");
          }

          if (user.status === "SUSPENDED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          if (user.status === "BANNED") {
            throw new Error("Your account has been banned.");
          }

          return {
            id: user.id,
            publicId: user.publicId,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider !== "google" && account?.provider !== "apple") {
          return true;
        }

        const email = user.email ? normalizeEmail(user.email) : null;
        if (!email) return false;
        // Make sure downstream lookups see the canonicalized form too.
        user.email = email;

        const providerField = account.provider === "google" ? "googleId" : "appleId";
        const providerId = account.providerAccountId;

        const existingByProvider = await prisma.user.findUnique({
          where: { [providerField]: providerId } as { googleId: string } | { appleId: string },
        });

        if (existingByProvider) {
          if (existingByProvider.status === "SUSPENDED" || existingByProvider.status === "BANNED") {
            return false;
          }
          return true;
        }

        const existingByEmail = await prisma.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          if (existingByEmail.status === "SUSPENDED" || existingByEmail.status === "BANNED") {
            return false;
          }

          const existingPrefs = (existingByEmail.preferences as Record<string, unknown> | null) ?? {};
          const legalMetadata =
            acceptedLegalVersion === CURRENT_LEGAL_VERSION
              ? createLegalAcceptanceMetadata()
              : null;

          await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              [providerField]: providerId,
              emailVerified: true,
              name: existingByEmail.name || user.name,
              ...(legalMetadata && {
                preferences: {
                  ...existingPrefs,
                  ...legalMetadata,
                },
              }),
            },
          });
          return true;
        }

        if (acceptedLegalVersion !== CURRENT_LEGAL_VERSION) {
          return "/signup?legal=required";
        }

        const publicId = await generatePublicId();
        await prisma.user.create({
          data: {
            email,
            [providerField]: providerId,
            name: user.name || null,
            publicId,
            role: "BORROWER",
            emailVerified: true,
            preferences: {
              needsRoleSelection: true,
              ...createLegalAcceptanceMetadata(),
            },
          },
        });

        return true;
      },

      async jwt({ token, account, trigger }) {
        // On initial sign-in / explicit `update` trigger we hydrate the token
        // from the DB. We also stamp `tokenVersion` so the session callback
        // can later detect revocation.
        if (account || trigger === "update") {
          const lookupEmail = token.email ? normalizeEmail(token.email) : "";
          const dbUser = await prisma.user.findUnique({
            where: { email: lookupEmail },
            select: {
              id: true,
              publicId: true,
              role: true,
              preferences: true,
              tokenVersion: true,
              status: true,
            },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.publicId = dbUser.publicId;
            token.role = dbUser.role;
            token.tokenVersion = dbUser.tokenVersion;
            token.status = dbUser.status;
            const prefs = dbUser.preferences as Record<string, unknown> | null;
            token.needsRoleSelection = prefs?.needsRoleSelection === true;
            token.needsNameEntry = prefs?.needsNameEntry === true;
          }
        }
        return token;
      },

      async session({ session, token }) {
        // Server-side revocation gate. Every session read re-checks the user's
        // tokenVersion + status from the DB. Mismatch ⇒ return an empty object
        // so NextAuth's useSession() / getServerSession() treats this as
        // "no session" (consumers do `if (!session) ...` everywhere).
        //
        // Returning a session with `user` mutated to undefined would crash any
        // consumer that does `session.user.role` — and there are ~30 such
        // sites — so we nuke the whole object instead.
        const userId = token.id as string | undefined;
        if (!userId) return session;

        // 5s per-user cache. Without it the SSR session callback hits Postgres
        // on every page render, which dominates DB load for active users.
        const now = Date.now();
        const cached = sessionDbCache.get(userId);
        let dbUser: SessionDbCacheEntry | null;
        if (cached && cached.expiresAt > now) {
          dbUser = cached;
        } else {
          const fresh = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              tokenVersion: true,
              status: true,
              role: true,
              publicId: true,
            },
          });
          if (fresh) {
            const entry: SessionDbCacheEntry = {
              tokenVersion: fresh.tokenVersion,
              status: fresh.status,
              role: fresh.role,
              publicId: fresh.publicId,
              expiresAt: now + SESSION_DB_CACHE_TTL_MS,
            };
            sessionDbCache.set(userId, entry);
            dbUser = entry;
          } else {
            dbUser = null;
          }
        }

        if (
          !dbUser ||
          dbUser.tokenVersion !== token.tokenVersion ||
          dbUser.status !== "ACTIVE"
        ) {
          // NextAuth assigns our return value directly to the response body
          // (next-auth/core/routes/session.js: `response.body = updatedSession`).
          // Returning null makes /api/auth/session emit `null`, which
          // useSession()/getServerSession() interpret as "unauthenticated"
          // — same shape every consumer already handles via `if (!session)`.
          // The TS signature insists on Session, so we cast.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return null as any;
        }

        if (session.user) {
          // Live DB values — role/publicId may have changed via select-role
          // or admin tools; we don't want a stale token to mask that. Types
          // are augmented in `types/next-auth.d.ts`, no casts needed.
          session.user.role = dbUser.role;
          session.user.id = userId;
          session.user.publicId = dbUser.publicId;
          session.user.needsRoleSelection = token.needsRoleSelection;
          session.user.needsNameEntry = token.needsNameEntry;
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
    session: {
      strategy: "jwt",
      // Web sessions: 7 days. Mobile flows that need longer-lived tokens
      // mint their own via `mobile-oauth.ts` / `select-role.ts`.
      maxAge: 7 * 24 * 60 * 60,
      updateAge: 60 * 60,
    },
    // Pin cookie attributes — never let NextAuth's defaults drift. `__Secure-`
    // prefix is enforced in production; in dev we strip it so HTTPS isn't
    // required locally.
    cookies: (() => {
      const isProd = process.env.NODE_ENV === "production";
      const cookieName = isProd
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token";
      return {
        sessionToken: {
          name: cookieName,
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isProd,
          },
        },
        callbackUrl: {
          name: isProd ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isProd,
          },
        },
        csrfToken: {
          name: isProd ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isProd,
          },
        },
      };
    })(),
    secret: process.env.NEXTAUTH_SECRET,
  };
}

export const authOptions: NextAuthOptions = createAuthOptions();
