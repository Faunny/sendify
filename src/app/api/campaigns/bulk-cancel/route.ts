// POST /api/campaigns/bulk-cancel
//
// Cancels multiple drafts at once. Wraps the same cancelCampaign() that the
// per-row endpoint uses. Up to 100 ids per call.
//
// Body: { ids: string[] }
// Returns: { ok: true, cancelled: number, failed: Array<{ id, error }> }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cancelCampaign } from "@/lib/pipeline/approve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ ok: false, error: "ids array required" }, { status: 400 });
  if (ids.length > 100) return NextResponse.json({ ok: false, error: "max 100 campaigns per bulk-cancel" }, { status: 400 });

  let cancelled = 0;
  const failed: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    try {
      await cancelCampaign(id);
      cancelled++;
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message.slice(0, 200) : "cancel failed" });
    }
  }
  return NextResponse.json({ ok: true, cancelled, failed, totalRequested: ids.length });
}
