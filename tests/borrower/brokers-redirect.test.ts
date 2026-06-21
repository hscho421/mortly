import { describe, it, expect } from "vitest";
import { getServerSideProps } from "@/pages/borrower/brokers/[requestId]";
import type { GetServerSidePropsContext } from "next";

// The standalone /borrower/brokers/[requestId] comparison page was folded into
// the request hub; this route now only redirects there.
const ctx = (params: Record<string, unknown>, locale?: string) =>
  ({ params, locale } as unknown as GetServerSidePropsContext);

describe("/borrower/brokers/[requestId] → request hub redirect", () => {
  it("redirects to the request hub #responses section (default locale)", async () => {
    const res = await getServerSideProps(ctx({ requestId: "700000001" }, "ko"));
    expect(res).toEqual({
      redirect: {
        destination: "/borrower/request/700000001#responses",
        permanent: false,
      },
    });
  });

  it("preserves a non-default locale prefix", async () => {
    const res = await getServerSideProps(ctx({ requestId: "700000001" }, "en"));
    expect(
      (res as { redirect: { destination: string } }).redirect.destination,
    ).toBe("/en/borrower/request/700000001#responses");
  });

  it("falls back to the dashboard when the id is missing", async () => {
    const res = await getServerSideProps(ctx({}, "ko"));
    expect(
      (res as { redirect: { destination: string } }).redirect.destination,
    ).toBe("/borrower/dashboard");
  });
});
