import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, brokerSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

// Mock the server-only storage admin so no real Supabase client is created.
const createSignedUploadUrl = vi.fn(async () => ({
  data: { path: "brokers/user_broker_1.webp", token: "tok", signedUrl: "https://signed.example" },
  error: null,
}));
const remove = vi.fn(async () => ({ error: null }));
// Default: the confirm step finds a valid small WebP at the broker's path.
const list = vi.fn(async () => ({
  data: [{ name: "user_broker_1.webp", metadata: { mimetype: "image/webp", size: 24000 } }],
  error: null,
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  AVATAR_BUCKET: "avatars",
  brokerAvatarPath: (id: string) => `brokers/${id}.webp`,
  avatarPublicUrl: (p: string) => `https://x.supabase.co/storage/v1/object/public/avatars/${p}`,
  isAvatarStorageConfigured: true,
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ createSignedUploadUrl, remove, list }) },
  }),
}));

import uploadUrlHandler from "@/pages/api/brokers/avatar/upload-url";
import avatarHandler from "@/pages/api/brokers/avatar/index";

describe("POST /api/brokers/avatar/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
  });

  it("403s a non-broker", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({ method: "POST" });
    await uploadUrlHandler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("404s when no broker profile exists", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(null);
    const { req, res } = makeReqRes({ method: "POST" });
    await uploadUrlHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("403s a REJECTED broker", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({ verificationStatus: "REJECTED" } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await uploadUrlHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(jsonBody<{ code?: string }>(res).code).toBe("REJECTED");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("allows a PENDING broker (can set a photo right after onboarding)", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({ verificationStatus: "PENDING" } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await uploadUrlHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(createSignedUploadUrl).toHaveBeenCalled();
  });

  it("returns a signed upload URL for a verified broker, scoped to their own path", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({ verificationStatus: "VERIFIED" } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await uploadUrlHandler(req, res);
    expect(res.statusCode).toBe(200);
    const body = jsonBody<{ path: string; token: string; signedUrl: string }>(res);
    expect(body.path).toBe("brokers/user_broker_1.webp");
    expect(body.token).toBe("tok");
    // Path is derived server-side from the session user — not client-supplied.
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      "brokers/user_broker_1.webp",
      { upsert: true },
    );
  });
});

describe("POST/DELETE /api/brokers/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue({ id: "broker_1" } as never);
  });

  it("confirm (POST) stores the server-derived path on profilePhoto", async () => {
    prismaMock.broker.update.mockResolvedValue({ profilePhoto: "brokers/user_broker_1.webp" } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(200);
    const updateArgs = prismaMock.broker.update.mock.calls[0][0];
    expect(updateArgs.data.profilePhoto).toBe("brokers/user_broker_1.webp");
    expect(jsonBody<{ url: string }>(res).url).toContain("brokers/user_broker_1.webp");
  });

  it("confirm rejects a non-WebP object (e.g. HTML uploaded via the signed URL) and cleans it up", async () => {
    list.mockResolvedValueOnce({
      data: [{ name: "user_broker_1.webp", metadata: { mimetype: "text/html", size: 2000 } }],
      error: null,
    } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ code: string }>(res).code).toBe("INVALID_IMAGE_TYPE");
    expect(remove).toHaveBeenCalledWith(["brokers/user_broker_1.webp"]);
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("confirm rejects when no object was actually uploaded", async () => {
    list.mockResolvedValueOnce({ data: [], error: null } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ code: string }>(res).code).toBe("UPLOAD_MISSING");
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("confirm rejects an oversize object", async () => {
    list.mockResolvedValueOnce({
      data: [{ name: "user_broker_1.webp", metadata: { mimetype: "image/webp", size: 5 * 1024 * 1024 } }],
      error: null,
    } as never);
    const { req, res } = makeReqRes({ method: "POST" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(jsonBody<{ code: string }>(res).code).toBe("IMAGE_TOO_LARGE");
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("DELETE removes the object and nulls the field", async () => {
    prismaMock.broker.update.mockResolvedValue({} as never);
    const { req, res } = makeReqRes({ method: "DELETE" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(remove).toHaveBeenCalledWith(["brokers/user_broker_1.webp"]);
    expect(prismaMock.broker.update.mock.calls[0][0].data.profilePhoto).toBeNull();
  });

  it("404s when no broker profile exists", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(null);
    const { req, res } = makeReqRes({ method: "POST" });
    await avatarHandler(req, res);
    expect(res.statusCode).toBe(404);
  });
});
