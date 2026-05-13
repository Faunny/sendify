// NextAuth.js v5 catch-all route handler — exposes /api/auth/* endpoints
// (signin, callback, signout, session, csrf, providers). Without this file the
// signIn() call from the login form 404s.
import { handlers } from "@/lib/auth";

export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const { GET, POST } = handlers;
