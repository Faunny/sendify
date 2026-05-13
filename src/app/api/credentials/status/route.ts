// GET /api/credentials/status?provider=...&scope=...
//
// Lightweight existence check used by CredentialCard on mount so the UI can
// reflect what's already saved. Returns existence + last-test metadata. Never
// returns the encrypted value. Must respond in under 10s even on Neon cold-start
// so the UI doesn't sit on "No configurado" while waiting.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ProviderType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Race the DB query against a deadline so the endpoint always responds. If the
// query is still pending past the deadline we return exists=null (UI keeps the
// last-known state instead of falsely flipping to "No configurado").
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function GET(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") as ProviderType | null;
  const scope    = url.searchParams.get("scope");
  if (!provider) return NextResponse.json({ ok: false, error: "missing provider" }, { status: 400 });

  const row = await withDeadline(
    prisma.providerCredential.findFirst({
      where: { provider, scope: scope ?? null, active: true },
      select: { label: true, lastTestOk: true, lastTestedAt: true, lastTestError: true, updatedAt: true },
    }).catch(() => null),
    8000,
  );

  // null = either no row OR query exceeded the deadline. Mark exists=false but
  // also flag coldStart so the client can keep its current state instead of
  // flipping to "No configurado".
  const reachedDb = row !== null || row === undefined;
  return NextResponse.json({
    ok: true,
    exists: !!row,
    coldStart: !reachedDb,
    label: row?.label ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestedAt: row?.lastTestedAt ?? null,
    lastTestError: row?.lastTestError ?? null,
  });
}
