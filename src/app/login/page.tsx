"use client";

import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/app/logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-app grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 mb-8">
          <Logo />
          <div className="text-center">
            <h1 className="text-[20px] font-medium tracking-tight">Sign in to Sendify</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Magic link · no password
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            {sent ? (
              <div className="text-center space-y-2">
                <Mail className="h-6 w-6 text-[color:var(--accent)] mx-auto" />
                <p className="text-[13px]">Check your inbox. We sent a sign-in link to <span className="font-medium">{email}</span>.</p>
                <button onClick={() => setSent(false)} className="text-[11px] text-muted-foreground underline">
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-3">
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
                <Button type="submit" className="w-full">
                  Send magic link <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By signing in you agree to the Sendify terms. Sessions last 30 days.
        </p>
      </div>
    </div>
  );
}
