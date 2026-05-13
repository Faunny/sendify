// GET    /api/templates/[id]  — fetch a template
// PATCH  /api/templates/[id]  — update name / mjml (+ optional subject/preheader stored as part of mjml is fine)
// DELETE /api/templates/[id]  — archive (sets archivedAt)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const t = await prisma.template.findUnique({
    where: { id },
    select: { id: true, name: true, kind: true, mjml: true, updatedAt: true, storeId: true, store: { select: { name: true, slug: true } } },
  });
  if (!t) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, template: t });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({} as { name?: string; mjml?: string }));
  const data: { name?: string; mjml?: string } = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 200);
  if (typeof body.mjml === "string") {
    if (body.mjml.length < 20 || !body.mjml.includes("<mjml")) {
      return NextResponse.json({ ok: false, error: "mjml looks empty or invalid" }, { status: 400 });
    }
    data.mjml = body.mjml;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });

  try {
    const t = await prisma.template.update({ where: { id }, data, select: { id: true, name: true, updatedAt: true } });
    return NextResponse.json({ ok: true, template: t });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.template.update({ where: { id }, data: { archivedAt: new Date() } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
