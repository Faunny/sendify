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
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/api/shopify/webhook") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/robots");
      if (isPublic) return true;
      return !!session?.user;
    },
  },
} satisfies NextAuthConfig;
