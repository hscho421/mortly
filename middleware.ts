import { NextResponse, type NextRequest } from "next/server";

/**
 * Mobile auth bridge.
 *
 * React Native (iOS especially, via NSURLSession) does not reliably send a
 * manually-set `Cookie` header, so the native app sends its next-auth session
 * token as `Authorization: Bearer <token>`. This middleware translates that into
 * the session cookie the API reads via getServerSession — so every existing
 * endpoint authenticates the app with no per-route changes.
 *
 * Browsers never send `Authorization: Bearer` (they use the HttpOnly cookie), so
 * web requests pass through untouched.
 */
const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return NextResponse.next();

  const token = auth.slice(7).trim();
  // Don't clobber a real session cookie if one is somehow already present.
  if (!token || req.cookies.get(COOKIE_NAME)) return NextResponse.next();

  const headers = new Headers(req.headers);
  const existing = headers.get("cookie");
  headers.set("cookie", existing ? `${existing}; ${COOKIE_NAME}=${token}` : `${COOKIE_NAME}=${token}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
