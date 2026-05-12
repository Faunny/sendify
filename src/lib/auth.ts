import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

// Full auth config — Node runtime only (Prisma adapter not Edge-compatible).
// Middleware uses the slim authConfig from ./auth.config.ts instead.
//
// Bootstrap login: ADMIN_EMAIL + ADMIN_PASSWORD env vars. Magic-link can be added
// alongside once SES is configured; both providers can coexist.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: "admin-password",
      name: "Admin password",
      credentials: { email: { label: "Email" }, password: { label: "Password" } },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        const expectedEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
        const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
        if (!expectedEmail || !expectedPassword) return null;
        if (email !== expectedEmail) return null;
        if (password !== expectedPassword) return null;
        return { id: "admin", email, name: "Admin", role: "ADMIN" };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id ?? "admin";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role ?? "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = token.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).role = token.role;
      return session;
    },
  },
});
