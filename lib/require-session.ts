import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function requireSession(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
}
