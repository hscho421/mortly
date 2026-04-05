import type { GetServerSideProps } from "next";

export default function BrokerConversationsRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/broker/messages", permanent: true },
});
