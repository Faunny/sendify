// GET    /api/campaigns/[id]  — fetch a campaign
// PATCH  /api/campaigns/[id]  — update mutable fields (subject, preheader, scheduledFor)
// DELETE /api/campaigns/[id]  — soft delete (status → CANCELLED + ledger updated)
//
// Approve / cancel live on their own routes (approve/route.ts and cancel/route.ts) since
// they trigger side-effects (queue, translation pipeline) that don't fit a PATCH semantic.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: { store: true, sender: true, variants: { select: { language: true } } },
  });
  if (!c) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: c });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const { subject, preheader, scheduledFor, name } = body as {
    subject?: string; preheader?: string | null; scheduledFor?: string | null; name?: string;
  };

  // Only allow editing in pre-send states. Once SENDING/SENT, edits would silently
  // diverge from what was already shipped to recipients.
  const current = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (current.status === "SENDING" || current.status === "SENT") {
    return NextResponse.json({ ok: false, error: `cannot edit a ${current.status} campaign` }, { status: 400 });
  }

  try {
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(subject       !== undefined && { subject }),
        ...(preheader     !== undefined && { preheader }),
        ...(name          !== undefined && { name }),
        ...(scheduledFor  !== undefined && { scheduledFor: scheduledFor ? new Date(scheduledFor) : null }),
      },
    });
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "delete failed" }, { status: 500 });
  }
}
