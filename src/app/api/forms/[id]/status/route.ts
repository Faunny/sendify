// POST /api/forms/[id]/status — flip a form between DRAFT / PUBLISHED / ARCHIVED.
// Toggling to PUBLISHED is what makes the embed snippet serve real JS instead
// of the "not found / unpublished" stub.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as { status?: string }));
  const target = body.status;
  if (!target || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(target)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }

  try {
    const updated = await prisma.form.update({
      where: { id },
      data: {
        status: target as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        ...(target === "PUBLISHED"  && { publishedAt: new Date() }),
        ...(target === "ARCHIVED"   && { archivedAt:  new Date() }),
      },
    });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "update failed",
    }, { status: 500 });
  }
}
