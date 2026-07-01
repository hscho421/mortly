import { api, ApiError, loginWithPassword, selectRole, updateName, deleteAccount } from "@/api/client";

describe("api client", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends the x-mortly-mobile header and returns JSON on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ hello: "world" }) });
    const data = await api<{ hello: string }>("/api/x");
    expect(data).toEqual({ hello: "world" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["x-mortly-mobile"]).toBe("1");
  });

  it("attaches the session cookie only when a token is provided", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await api("/api/x", { token: "jwt123" });
    expect(fetchMock.mock.calls[0][1].headers["Cookie"]).toContain("jwt123");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await api("/api/x");
    expect(fetchMock.mock.calls[0][1].headers["Cookie"]).toBeUndefined();
  });

  it("throws ApiError with the backend sentinel code + status on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "INVALID_CREDENTIALS" }),
    });
    await expect(loginWithPassword("a@b.com", "x")).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_CREDENTIALS",
      status: 401,
    });
  });

  it("falls back to REQUEST_FAILED when the body has no error field", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(api("/api/x")).rejects.toMatchObject({ code: "REQUEST_FAILED", status: 500 });
    await expect(api("/api/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("selectRole POSTs the chosen role authenticated", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, role: "BROKER", sessionToken: "new" }),
    });
    const res = await selectRole("tok", "BROKER");
    expect(res).toMatchObject({ role: "BROKER", sessionToken: "new" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/auth/select-role");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ role: "BROKER" });
    expect(init.headers["Cookie"]).toContain("tok");
  });

  it("updateName PATCHes the name and returns the refreshed user", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, sessionToken: "new", user: { id: "u1" } }),
    });
    const res = await updateName("tok", "Hyun Seok");
    expect(res.user).toMatchObject({ id: "u1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "Hyun Seok" });
  });

  it("deleteAccount DELETEs with the ack + password (credentials account)", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await deleteAccount("tok", "pw123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/users/me");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ currentPassword: "pw123", ack: "DELETE_MY_ACCOUNT" });
  });

  it("deleteAccount omits the password for OAuth-only accounts", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await deleteAccount("tok");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ack: "DELETE_MY_ACCOUNT" });
  });
});
