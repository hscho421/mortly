import type { TFunction } from "i18next";
import { respondGate } from "@/lib/brokerGate";
import type { BrokerProfile } from "@/api/client";

const t = ((key: string, def?: string) => def ?? key) as unknown as TFunction;

const base: BrokerProfile = {
  id: "b1",
  userId: "u1",
  brokerageName: "ACME",
  province: "Ontario",
  verificationStatus: "VERIFIED",
  subscriptionTier: "PRO",
  responseCredits: 3,
  mortgageCategory: null,
  profilePhoto: null,
  subscription: { status: "ACTIVE", tier: "PRO" },
  user: { id: "u1", publicId: "1", name: "B", email: "b@x.com" },
};

describe("respondGate", () => {
  it("already responded", () => {
    expect(respondGate(base, true, t).kind).toBe("responded");
  });

  it("unverified → blocked (not verified)", () => {
    expect(respondGate({ ...base, verificationStatus: "PENDING" }, false, t)).toMatchObject({
      kind: "blocked",
      code: "BROKER_NOT_VERIFIED",
    });
  });

  it("free tier → blocked (upgrade)", () => {
    expect(respondGate({ ...base, subscriptionTier: "FREE" }, false, t)).toMatchObject({
      kind: "blocked",
      code: "UPGRADE_REQUIRED",
    });
  });

  it("lapsed subscription → blocked (past due)", () => {
    expect(
      respondGate({ ...base, subscription: { status: "PAST_DUE", tier: "PRO" } }, false, t),
    ).toMatchObject({ kind: "blocked", code: "SUBSCRIPTION_PAST_DUE" });
  });

  it("paid but out of credits → no_credits", () => {
    expect(respondGate({ ...base, responseCredits: 0 }, false, t).kind).toBe("no_credits");
  });

  it("active premium → ok + unlimited (no credit needed)", () => {
    expect(
      respondGate(
        { ...base, subscriptionTier: "PREMIUM", responseCredits: 0, subscription: { status: "ACTIVE", tier: "PREMIUM" } },
        false,
        t,
      ),
    ).toMatchObject({ kind: "ok", unlimited: true });
  });

  it("paid with credits → ok (metered)", () => {
    expect(respondGate(base, false, t)).toMatchObject({ kind: "ok", unlimited: false, creditsRemaining: 3 });
  });
});
