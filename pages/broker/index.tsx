import type { GetServerSideProps } from "next";

export default function BrokerIndexRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/broker/dashboard", permanent: false },
});
