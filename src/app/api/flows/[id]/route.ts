// PATCH  /api/flows/[id]   — toggle active, rename
// DELETE /api/flows/[id]   — cancel all enrollments + remove the flow
//
// PATCH body: { active?: boolean, name?: string }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const data: { active?: boolean; name?: string } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.name === "string" && body.name.trim().length > 0) data.name = body.name.trim().slice(0, 80);

  try {
    const flow = await prisma.flow.update({ where: { id }, data });
    return NextResponse.json({ ok: true, flow });
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
    // Cancel any in-flight enrollments so the cron stops touching them.
    await prisma.flowEnrollment.updateMany({
      where: { flowId: id, status: "ACTIVE" },
      data:  { status: "CANCELLED", completedAt: new Date() },
    });
    await prisma.flow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "delete failed" }, { status: 500 });
  }
}
