// Auth gate. Uses the slim Edge-compatible config from src/lib/auth.config.ts
// (no Prisma) so the middleware bundle stays under Vercel's 1 MB Edge cap.
//
// The `authorized` callback decides whether the request proceeds; if it returns
// false NextAuth emits a redirect to /login (configured in pages.signIn).

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

export default middleware((req) => {
  // For API routes return 401 JSON instead of bouncing to /login HTML (cleaner
  // for fetch() clients). Pages get the default NextAuth redirect to /login.
  const { auth: session, nextUrl } = req;
  if (nextUrl.pathname.startsWith("/api/") && !session?.user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
});
