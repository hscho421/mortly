import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { generatePublicId } from "./publicId";
import { CURRENT_LEGAL_VERSION, createLegalAcceptanceMetadata } from "./legal";

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

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
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

        const email = user.email;
        if (!email) return false;

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
        // On initial sign-in or session update (e.g. after role selection), load user from DB
        if (account || trigger === "update") {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            select: { id: true, publicId: true, role: true, preferences: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.publicId = dbUser.publicId;
            token.role = dbUser.role;
            const prefs = dbUser.preferences as Record<string, unknown> | null;
            token.needsRoleSelection = prefs?.needsRoleSelection === true;
          }
        }
        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).role = token.role;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).id = token.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).publicId = token.publicId;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).needsRoleSelection = token.needsRoleSelection;
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
    session: {
      strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
  };
}

export const authOptions: NextAuthOptions = createAuthOptions();
