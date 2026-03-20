import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      publicId: string;
      role: "BORROWER" | "BROKER" | "ADMIN";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    publicId: string;
    role: "BORROWER" | "BROKER" | "ADMIN";
  }
}
