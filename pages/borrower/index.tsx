import type { GetServerSideProps } from "next";

export default function BorrowerIndexRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/borrower/dashboard", permanent: false },
});
