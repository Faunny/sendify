"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/app/logo";

// useSearchParams forces a Suspense boundary in Next.js 15 — extracting the form
// into a child component keeps the page itself prerender-safe.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    const res = await signIn("admin-password", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) { setError("Email o contraseña inválidos."); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Email</span>
        <Input
          type="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@divainparfums.com"
          className="mt-1.5"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Password</span>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1.5"
        />
      </label>
      {error && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[11px] text-[color:var(--danger)] flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-app grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 mb-8">
          <Logo />
          <div className="text-center">
            <h1 className="text-[20px] font-medium tracking-tight">Sign in to Sendify</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Admin access · email + password
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <Suspense fallback={<div className="text-[11px] text-muted-foreground">Loading…</div>}>
              <LoginForm />
            </Suspense>
            <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex items-start gap-2">
              <Lock className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Credenciales en <code>ADMIN_EMAIL</code> + <code>ADMIN_PASSWORD</code> (Vercel env).</span>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Sessions last 30 days.
        </p>
      </div>
    </div>
  );
}
