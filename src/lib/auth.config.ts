// Edge-compatible auth config — must not import anything that pulls in Prisma,
// bcrypt, or other Node-only deps. Middleware uses this slim config so it stays
// under the 1 MB Edge bundle cap.
//
// The full config in ./auth.ts extends this with the Prisma adapter + Credentials
// provider, and is used by the API routes that run on the Node runtime.

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      // Endpoints that intentionally accept anonymous traffic from external systems
      // (their own auth is HMAC-signed bodies or token-in-URL, not session cookies).
      const isPublicApi =
        pathname.startsWith("/api/auth/")              ||
        pathname.startsWith("/api/shopify/webhook")    ||
        pathname.startsWith("/api/promotions/webhook") ||
        pathname.startsWith("/api/ses/events")         ||
        pathname.startsWith("/api/cron/")              ||
        // Form submissions + the embed JS must be open so the storefront can POST.
        // Routes look like /api/forms/{slug}/submit and /api/forms/{slug}/embed.js
        (pathname.startsWith("/api/forms/") &&
          (pathname.endsWith("/submit") || pathname.endsWith("/embed.js")));
      const isPublicPage =
        pathname.startsWith("/login")    ||
        pathname.startsWith("/forms/")   ||   // hosted form pages
        pathname.startsWith("/_next/")   ||
        pathname.startsWith("/favicon")  ||
        pathname.startsWith("/robots");
      if (isPublicApi || isPublicPage) return true;
      return !!session?.user;
    },
  },
} satisfies NextAuthConfig;
