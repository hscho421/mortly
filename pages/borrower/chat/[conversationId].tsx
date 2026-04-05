import type { GetServerSideProps } from "next";

export default function BorrowerChatRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  redirect: {
    destination: `/borrower/messages?id=${params?.conversationId ?? ""}`,
    permanent: true,
  },
});
