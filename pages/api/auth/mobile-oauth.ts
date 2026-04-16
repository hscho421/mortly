import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";
import { OAuth2Client } from "google-auth-library";
import appleSigninAuth from "apple-signin-auth";
import prisma from "@/lib/prisma";
import { generatePublicId } from "@/lib/publicId";
import { CURRENT_LEGAL_VERSION, createLegalAcceptanceMetadata } from "@/lib/legal";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

type Provider = "google" | "apple";

type GoogleIdentity = {
  providerId: string;
  email: string;
  name: string | null;
};

async function verifyGoogle(idToken: string): Promise<GoogleIdentity> {
  const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.GOOGLE_CLIENT_ID;
  if (!iosClientId && !webClientId) {
    throw new Error("Google client IDs not configured");
  }
  const client = new OAuth2Client();
  const audience = [iosClientId, webClientId].filter(Boolean) as string[];
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google token payload");
  }
  return {
    providerId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? null,
  };
}

type AppleIdentity = {
  providerId: string;
  email: string | null;
  name: string | null;
};

async function verifyApple(
  idToken: string,
  fallbackName: string | null
): Promise<AppleIdentity> {
  // Native iOS Sign in with Apple sets `aud` = app bundle ID (app.mortly.mobile).
  // Web SIA sets `aud` = Services ID (app.mortly.mobile.signin).
  // APPLE_CLIENT_ID accepts comma-separated values so both flows validate.
  const raw = process.env.APPLE_CLIENT_ID;
  if (!raw) {
    throw new Error("Apple client ID not configured");
  }
  const audiences = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (audiences.length === 0) {
    throw new Error("Apple client ID not configured");
  }
  const payload = await appleSigninAuth.verifyIdToken(idToken, {
    audience: audiences.length === 1 ? audiences[0] : audiences,
    ignoreExpiration: false,
  });
  if (!payload?.sub) {
    throw new Error("Invalid Apple token payload");
  }
  return {
    providerId: payload.sub,
    email: payload.email ? payload.email.toLowerCase() : null,
    name: fallbackName,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server auth not configured" });
  }

  try {
    const { provider, idToken, name: fallbackName } = req.body as {
      provider?: Provider;
      idToken?: string;
      name?: string | null;
    };

    if (!provider || !idToken) {
      return res.status(400).json({ error: "Missing provider or idToken" });
    }
    if (provider !== "google" && provider !== "apple") {
      return res.status(400).json({ error: "Unsupported provider" });
    }

    const identity =
      provider === "google"
        ? await verifyGoogle(idToken)
        : await verifyApple(idToken, fallbackName ?? null);

    if (provider === "apple" && !identity.email) {
      const existingByAppleId = await prisma.user.findUnique({
        where: { appleId: identity.providerId },
      });
      if (!existingByAppleId) {
        return res
          .status(400)
          .json({ error: "Apple did not return an email. Unable to create account." });
      }
    }

    const providerIdField = provider === "google" ? "googleId" : "appleId";

    let user = await prisma.user.findUnique({
      where: { [providerIdField]: identity.providerId } as { googleId: string } | { appleId: string },
    });

    // Backfill name if the existing user has none but the client provided one.
    // Apple only returns fullName on first auth; if the first auth failed
    // server-side the user row may exist with name = null. Never overwrite
    // a name the user has already set.
    if (user && !user.name && identity.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: identity.name },
      });
    }

    if (!user && identity.email) {
      user = await prisma.user.findUnique({ where: { email: identity.email } });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            [providerIdField]: identity.providerId,
            emailVerified: true,
            name: user.name ?? identity.name,
          },
        });
      }
    }

    if (!user) {
      if (!identity.email) {
        return res.status(400).json({ error: "Email required to create account" });
      }
      const publicId = await generatePublicId();
      user = await prisma.user.create({
        data: {
          email: identity.email,
          [providerIdField]: identity.providerId,
          name: identity.name,
          publicId,
          role: "BORROWER",
          emailVerified: true,
          preferences: {
            needsRoleSelection: true,
            // Apple returns fullName only on the FIRST authorization per Apple
            // ID. If we have no name at create-time, force the user through a
            // name-entry screen before the dashboard.
            ...(identity.name ? {} : { needsNameEntry: true }),
            ...createLegalAcceptanceMetadata(),
          },
        },
      });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "Account suspended" });
    }
    if (user.status === "BANNED") {
      return res.status(403).json({ error: "Account banned" });
    }

    const prefs = (user.preferences as Record<string, unknown> | null) ?? {};
    const needsRoleSelection = prefs.needsRoleSelection === true;
    const needsNameEntry = prefs.needsNameEntry === true || !user.name;

    const token = await encode({
      token: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        name: user.name,
        role: user.role,
        needsRoleSelection,
        needsNameEntry,
      },
      secret,
      maxAge: SESSION_MAX_AGE,
    });

    return res.status(200).json({
      sessionToken: token,
      user: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        name: user.name,
        role: user.role,
        needsRoleSelection,
        needsNameEntry,
      },
    });
  } catch (err) {
    console.error("Mobile OAuth error:", err);
    console.error("OAuth verification detail:", err instanceof Error ? err.message : err);
    return res.status(401).json({ error: "Authentication failed" });
  }
}
