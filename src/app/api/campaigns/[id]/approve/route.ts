// POST /api/campaigns/[id]/approve
//
// Body: { targetLanguages?: string[], comment?: string }
// Auth: any signed-in admin or user. Returns the final audience counts + enqueue stats.
//
// In dev mode without Redis the orchestrator throws when trying to enqueue. We catch that
// and return a 202-style response with the work that DID happen (translate/render/ledger),
// so the UI can still flip the campaign to APPROVED for QA without forcing local Redis.

import { NextResponse } from "next/server";
import { approveCampaign } from "@/lib/pipeline/approve";
import { auth } from "@/lib/auth";
import { LANGUAGES } from "@/lib/languages";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as { targetLanguages?: string[]; comment?: string }));
  const targetLanguages = body.targetLanguages ?? LANGUAGES.map((l) => l.code);

  try {
    const result = await approveCampaign({
      campaignId: id,
      approverId: userId,
      comment: body.comment,
      targetLanguages,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "approve failed";
    // Distinguish a Redis-unreachable failure from a real campaign-state error.
    if (/ECONNREFUSED|connect.*redis|getRedis/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "queue unreachable", note: "campaign approved + variants rendered, but sends were not enqueued (Redis down)" },
        { status: 202 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
