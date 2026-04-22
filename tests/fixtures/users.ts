import type { User, Broker } from "@prisma/client";

type UserOverrides = Partial<User>;
type BrokerOverrides = Partial<Broker>;

const baseDate = new Date("2026-01-01T00:00:00Z");

export function makeUser(overrides: UserOverrides = {}): User {
  return {
    id: "user_borrower_1",
    publicId: "100000001",
    email: "borrower@test.com",
    passwordHash: "$2a$12$hashedplaceholderhashedplaceholder..",
    googleId: null,
    appleId: null,
    role: "BORROWER",
    status: "ACTIVE",
    name: "Bob Borrower",
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiry: null,
    verificationCodeSentAt: null,
    resetToken: null,
    resetTokenExpiry: null,
    preferences: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  } as User;
}

export function makeBrokerUser(overrides: UserOverrides = {}): User {
  return makeUser({
    id: "user_broker_1",
    publicId: "200000001",
    email: "broker@test.com",
    name: "Brenda Broker",
    role: "BROKER",
    ...overrides,
  });
}

export function makeAdminUser(overrides: UserOverrides = {}): User {
  return makeUser({
    id: "user_admin_1",
    publicId: "900000001",
    email: "admin@test.com",
    name: "Alice Admin",
    role: "ADMIN",
    ...overrides,
  });
}

export function makeBroker(overrides: BrokerOverrides = {}): Broker {
  return {
    id: "broker_1",
    userId: "user_broker_1",
    brokerageName: "Acme Mortgage Co",
    province: "Ontario",
    licenseNumber: "LIC-12345",
    phone: "+14165551234",
    mortgageCategory: "BOTH",
    bio: "20 years experience",
    yearsExperience: 20,
    areasServed: "GTA",
    specialties: "First-time buyers",
    profilePhoto: null,
    stripeCustomerId: null,
    verificationStatus: "VERIFIED",
    subscriptionTier: "BASIC",
    responseCredits: 5,
    lastRequestsSeenAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  } as Broker;
}
