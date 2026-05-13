// GET /api/credentials/status?provider=...&scope=...
//
// Lightweight existence check used by CredentialCard on mount so the UI can
// reflect what's already saved instead of showing "No configurado" on every page
// load. Returns existence + last-test metadata. Never returns the encrypted value.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ProviderType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function pingDb(maxAttempts = 4): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 3000)));
    }
  }
}

export async function GET(req: Request) {
  await pingDb();
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") as ProviderType | null;
  const scope    = url.searchParams.get("scope");
  if (!provider) return NextResponse.json({ ok: false, error: "missing provider" }, { status: 400 });

  const row = await prisma.providerCredential.findFirst({
    where: { provider, scope: scope ?? null, active: true },
    select: { label: true, lastTestOk: true, lastTestedAt: true, lastTestError: true, updatedAt: true },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    exists: !!row,
    label: row?.label ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestedAt: row?.lastTestedAt ?? null,
    lastTestError: row?.lastTestError ?? null,
  });
}
