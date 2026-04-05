import type { GetServerSideProps } from "next";

export default function BrokerConversationRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  redirect: {
    destination: `/broker/messages?id=${params?.id ?? ""}`,
    permanent: true,
  },
});
