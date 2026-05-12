// POST /api/segments/clone
//
// Body (form-urlencoded or JSON): { presetId, storeId? }
// Creates a new Segment from a preset, immediately evaluates its size against the
// current Customer table, then redirects back to /segments. If storeId is omitted, the
// segment is global (matches across all stores).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SEGMENT_PRESETS, rulesToWhere } from "@/lib/segment-presets";

export async function POST(req: Request) {
  // Accept both form-urlencoded (from the <form> button) and JSON.
  const contentType = req.headers.get("content-type") ?? "";
  let presetId: string | null = null;
  let storeId:  string | null = null;
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    presetId = body.presetId ?? null;
    storeId  = body.storeId  ?? null;
  } else {
    const form = await req.formData();
    presetId = (form.get("presetId") as string) || null;
    storeId  = (form.get("storeId")  as string) || null;
  }

  if (!presetId) return NextResponse.json({ ok: false, error: "missing presetId" }, { status: 400 });
  const preset = SEGMENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return NextResponse.json({ ok: false, error: "preset not found" }, { status: 404 });

  // Default to the first store if user didn't pick one.
  if (!storeId) {
    const first = await prisma.store.findFirst({ orderBy: { slug: "asc" } });
    if (!first) return NextResponse.json({ ok: false, error: "no stores configured" }, { status: 400 });
    storeId = first.id;
  }

  // Evaluate current size so the new segment lands with a real count instead of zero.
  const where = rulesToWhere(preset.rules, storeId);
  const size = await prisma.customer.count({ where }).catch(() => 0);

  const seg = await prisma.segment.create({
    data: {
      storeId,
      name: preset.name,
      description: preset.description,
      rules: preset.rules as unknown as object,
      estimatedSize: size,
      lastEvaluatedAt: new Date(),
    },
  });

  // Form submissions land here; redirect back to the list. JSON callers get the row.
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL(`/segments?cloned=${seg.id}`, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, id: seg.id, size });
}
