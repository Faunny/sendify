// GET  /api/flows               — list all flows (with enrollment counters)
// POST /api/flows               — create a flow from a preset id, scoped to a store
//
// POST body: { storeId, presetId, name? }
//   storeId   — which Shopify store this flow runs on
//   presetId  — id from FLOW_PRESETS in lib/flows/presets.ts
//   name      — optional override (defaults to preset name)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findPreset } from "@/lib/flows/presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const flows = await prisma.flow.findMany({
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    include: {
      store: { select: { slug: true, name: true } },
      _count: { select: { enrollments: true, sends: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    flows: flows.map((f) => ({
      id: f.id,
      storeId: f.storeId,
      storeSlug: f.store.slug,
      storeName: f.store.name,
      name: f.name,
      trigger: f.trigger,
      active: f.active,
      lastTriggeredAt: f.lastTriggeredAt?.toISOString() ?? null,
      enrollmentCount: f._count.enrollments,
      sendCount: f._count.sends,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const storeId  = typeof body.storeId === "string" ? body.storeId : null;
    const presetId = typeof body.presetId === "string" ? body.presetId : null;
    const nameOverride = typeof body.name === "string" ? body.name.slice(0, 80) : null;

    if (!storeId || !presetId) {
      return NextResponse.json({ ok: false, error: "storeId + presetId required" }, { status: 400 });
    }

    const preset = findPreset(presetId);
    if (!preset) return NextResponse.json({ ok: false, error: `unknown preset: ${presetId}` }, { status: 400 });

    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

    // Round-trip the graph through JSON.parse(JSON.stringify(...)) so Prisma's
    // JSON serializer doesn't choke on anything funky. Presets are static
    // literals, but better safe.
    const graphJson = JSON.parse(JSON.stringify(preset.graph));

    const flow = await prisma.flow.create({
      data: {
        storeId,
        name: nameOverride ?? `${preset.name} · ${store.name}`,
        trigger: preset.trigger,
        reEnrollCooldownH: preset.reEnrollCooldownH,
        graph: graphJson,
        active: false, // created paused so the owner can review + flip on
      },
    });

    return NextResponse.json({ ok: true, flow });
  } catch (e) {
    // Log the real error so we can debug from Vercel logs, but return a clean
    // JSON shape — without this catch, a Prisma error throws and the browser
    // sees "Failed to fetch" instead of a useful message.
    console.error("[POST /api/flows] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "create failed",
    }, { status: 500 });
  }
}
