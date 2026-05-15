// POST /api/campaigns/bulk-approve
//
// Loops campaign IDs through the same approve pipeline used per-row. Bulk
// version for the /approvals page so the reviewer can select 20 drafts and
// approve them in one click instead of 20.
//
// Body: { ids: string[], targetLanguages?: string[] }
// Returns: { ok: true, approved: number, failed: Array<{ id, error }> }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveCampaign } from "@/lib/pipeline/approve";

export const dynamic = "force-dynamic";
// 300s is the Vercel function cap. Approving 1 campaign does translation +
// render + audience resolve + queue, ~10-30s each. 20 campaigns is ~5-10min
// — close to the cap. The client side does its own batching for safety.
export const maxDuration = 300;

// Default fan-out languages. The reviewer can override per-campaign via the
// detail page, but for bulk-approve we just hit the store's default and the
// common neighbours so the email goes out everywhere it's relevant.
const DEFAULT_LANGS = ["es-ES", "en-GB", "fr-FR", "de-DE", "it-IT", "pt-PT"];

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const targetLanguages = Array.isArray(body.targetLanguages)
    ? (body.targetLanguages as unknown[]).filter((x): x is string => typeof x === "string")
    : DEFAULT_LANGS;
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "ids array required" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ ok: false, error: "max 50 campaigns per bulk-approve" }, { status: 400 });
  }

  let approved = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    try {
      await approveCampaign({
        campaignId: id,
        approverId: userId,
        comment: "bulk approve",
        targetLanguages,
      });
      approved++;
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message.slice(0, 200) : "approve failed" });
    }
  }

  return NextResponse.json({ ok: true, approved, failed, totalRequested: ids.length });
}
