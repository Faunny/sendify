import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

// Full auth config. We deliberately do NOT register PrismaAdapter here — the
// adapter forces Neon connections on every auth invocation (csrf, providers,
// signIn) which made /api/auth/* hang for ~30s during Neon cold-start, blocking
// the login form from even fetching its CSRF token.
//
// Since session.strategy = "jwt" we don't need a database adapter; JWTs are
// signed with AUTH_SECRET and verified locally. When we add the magic-link
// email provider later (needs DB to store verification tokens), we'll re-add
// the adapter behind a feature flag and only run those routes on the Node
// runtime with a warmed connection.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
