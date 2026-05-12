import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

// Bootstrap-friendly auth: a single admin login backed by env vars (ADMIN_EMAIL +
// ADMIN_PASSWORD). Lets the owner sign in *before* SES is configured. After SES is
// wired we can add the magic-link provider back alongside this one — both work
// simultaneously.
//
// Sessions are JWT-based (not DB-backed) so the Credentials provider works. We still
// register the Prisma adapter so future OAuth/email providers can persist users.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
