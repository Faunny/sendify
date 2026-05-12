// POST   /api/credentials      — upsert a credential
// DELETE /api/credentials      — remove a credential
//
// Body for both:
//   { provider: ProviderType, scope?: string|null, value?: string, label?: string, meta?: object }
//
// `value` is required for POST. We encrypt + persist + invalidate the cache so the very
// next call to getCredential() picks up the new value. No redeploy.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setCredential, deleteCredential } from "@/lib/credentials";
import type { ProviderType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const { provider, scope, value, label, meta } = body as {
    provider: ProviderType; scope?: string | null; value?: string; label?: string; meta?: Record<string, unknown>;
  };

  if (!provider) return NextResponse.json({ ok: false, error: "missing provider" }, { status: 400 });
  if (!value || typeof value !== "string" || value.length < 4) {
    return NextResponse.json({ ok: false, error: "missing or invalid value" }, { status: 400 });
  }

  try {
    await setCredential({ provider, scope, value, label, meta });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "save failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") as ProviderType | null;
  const scope    = searchParams.get("scope");
  if (!provider) return NextResponse.json({ ok: false, error: "missing provider" }, { status: 400 });

  try {
    await deleteCredential(provider, scope);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete failed" },
      { status: 500 },
    );
  }
}
