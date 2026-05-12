// POST /api/campaigns/[id]/cancel
//
// Drains the BullMQ queue of pending jobs for this campaign and flips remaining
// `Send` rows to FAILED with reason "campaign cancelled". Sends that already left
// SES stay SENT (you can't unsend an email).

import { NextResponse } from "next/server";
import { cancelCampaign } from "@/lib/pipeline/approve";
import { auth } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await cancelCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cancel failed" },
      { status: 400 }
    );
  }
}
