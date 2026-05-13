// PATCH /api/flows/[id]/step
//
// Toggle or edit a specific step inside a flow's graph. Body shape:
//   { stepIndex: number, enabled?: boolean, subject?: string, preheader?: string, hours?: number }
//
// Only fields that match the step type are applied (enabled works for any
// step, subject/preheader only for sends, hours only for delays).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FlowGraph, FlowStep } from "@/lib/flows/presets";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const stepIndex = typeof body.stepIndex === "number" ? body.stepIndex : -1;
  if (stepIndex < 0) return NextResponse.json({ ok: false, error: "stepIndex required" }, { status: 400 });

  const flow = await prisma.flow.findUnique({ where: { id }, select: { graph: true } });
  if (!flow) return NextResponse.json({ ok: false, error: "flow not found" }, { status: 404 });

  const graph = flow.graph as unknown as FlowGraph;
  const step = graph.steps[stepIndex];
  if (!step) return NextResponse.json({ ok: false, error: "step index out of range" }, { status: 400 });

  // Mutate the step in place. Type-safe by step.type.
  const next: FlowStep = { ...step };
  if (typeof body.enabled === "boolean") next.enabled = body.enabled;
  if (next.type === "send") {
    if (typeof body.subject === "string")   next.subject   = body.subject.slice(0, 200);
    if (typeof body.preheader === "string") next.preheader = body.preheader.slice(0, 200);
  }
  if (next.type === "delay") {
    if (typeof body.hours === "number" && body.hours >= 0) next.hours = Math.min(body.hours, 24 * 365);
  }

  const newGraph: FlowGraph = { ...graph, steps: graph.steps.map((s, i) => i === stepIndex ? next : s) };
  await prisma.flow.update({
    where: { id },
    data: { graph: newGraph as unknown as object },
  });

  return NextResponse.json({ ok: true, step: next });
}
