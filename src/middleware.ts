// Auth gate. Uses the slim Edge-compatible config from src/lib/auth.config.ts
// (no Prisma) so the middleware bundle stays under Vercel's 1 MB Edge cap.
//
// The `authorized` callback in authConfig decides whether the request proceeds.
// When it returns true (public path) we let the request through untouched —
// otherwise the inner function below converts the 307-to-/login that NextAuth
// emits into a clean 401 JSON for /api/* so external systems get a useful error
// instead of a redirect they can't follow with POST (which surfaces as 405).

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

function isPublicApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/shopify/webhook") ||
    pathname.startsWith("/api/promotions/webhook") ||
    pathname.startsWith("/api/ses/events") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/events/track") ||
    pathname.startsWith("/api/assets/") ||
    (pathname.startsWith("/api/forms/") &&
      (pathname.endsWith("/submit") || pathname.endsWith("/embed.js")))
  );
}

export default middleware((req) => {
  const { auth: session, nextUrl } = req;
  const { pathname } = nextUrl;

  // Public API paths handle their own auth (HMAC, token in URL, CORS). Skip.
  if (isPublicApiPath(pathname)) return;

  // For protected /api/* without a session return a clean 401 JSON instead of
  // the default redirect to /login (which a POST client surfaces as 405).
  if (pathname.startsWith("/api/") && !session?.user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
});
