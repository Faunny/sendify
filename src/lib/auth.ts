import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  providers: [
    // Magic-link via the platform's own SES sender (configured at runtime).
    // Wiring this up requires SENDIFY_FROM_EMAIL plus a server with SES credentials.
    {
      id: "magic-link",
      name: "Magic Link",
      type: "email",
      from: process.env.SENDIFY_FROM_EMAIL ?? "noreply@divain.space",
      maxAge: 60 * 60, // 1 hour
      sendVerificationRequest: async ({ identifier, url }: { identifier: string; url: string }) => {
        // In production: ses.sendEmail({ ... template with magic link ... })
        if (process.env.NODE_ENV === "development") {
          console.log(`\n  → Magic link for ${identifier}: ${url}\n`);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ],
  callbacks: {
    async session({ session, user }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).role = (user as any).role;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = user.id;
      return session;
    },
  },
});
