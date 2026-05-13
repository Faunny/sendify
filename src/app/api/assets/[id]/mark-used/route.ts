// POST /api/assets/[id]/mark-used  — increment usedCount + set lastUsedAt
//
// Called when an asset gets composed into a template / campaign / send so the
// library UI can filter "unused" vs "used" and the AI generator can prefer
// fresh assets over re-using the same one twice.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const a = await prisma.asset.update({
      where: { id },
      data: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
      select: { id: true, usedCount: true, lastUsedAt: true },
    });
    return NextResponse.json({ ok: true, asset: a });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}
