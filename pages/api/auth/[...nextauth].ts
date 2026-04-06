import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { createAuthOptions } from "@/lib/auth";
import { LEGAL_ACCEPTANCE_COOKIE } from "@/lib/legal";

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const acceptedLegalVersion =
    typeof req.cookies[LEGAL_ACCEPTANCE_COOKIE] === "string"
      ? req.cookies[LEGAL_ACCEPTANCE_COOKIE]
      : null;

  return await NextAuth(req, res, createAuthOptions(acceptedLegalVersion));
}
