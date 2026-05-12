// Auth gate for the dashboard. Every non-public path is bounced to /login if
// there's no session. The (app) route group + every /api/* route except the
// public ones below is protected.
//
// Public surfaces:
//   /login, /api/auth/*, /api/shopify/webhook (Shopify needs to POST unauth'd),
//   _next assets, favicon, robots.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/shopify/webhook",
  "/_next/",
  "/favicon",
  "/robots",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await auth();
  if (session?.user) return NextResponse.next();

  // For API routes return 401 JSON; for pages bounce to /login with ?from.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets — they don't need auth-checks.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
