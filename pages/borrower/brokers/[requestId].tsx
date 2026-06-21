import type { GetServerSideProps } from "next";

// The standalone broker-comparison page ("모기지 전문가 소개") was folded into the
// request hub at /borrower/request/[id]#responses, so the borrower manages a
// request and the brokers who responded to it in one place. This route is kept
// only as a redirect so any stale links/bookmarks land in the right spot.
export const getServerSideProps: GetServerSideProps = async ({ params, locale }) => {
  const raw = params?.requestId;
  const requestId = Array.isArray(raw) ? raw[0] : raw;
  const prefix = locale && locale !== "ko" ? `/${locale}` : "";
  return {
    redirect: {
      destination: requestId
        ? `${prefix}/borrower/request/${requestId}#responses`
        : `${prefix}/borrower/dashboard`,
      permanent: false,
    },
  };
};

export default function BrokerComparisonRedirect() {
  return null;
}
