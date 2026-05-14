// DELETE /api/campaigns/auto-drafts
//
// Wipes every PENDING_APPROVAL campaign whose draftSource starts with "AUTO_"
// (auto-planner output). Used when the design template changes — drafts already
// generated with the old palette can be cleared and re-run with the new one.
//
// Sent + scheduled + manual drafts are left alone — only auto-drafted, still-
// pending rows go. Variants cascade-delete via Prisma's relation.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    // First fetch the ids so we can return a count to the UI.
    const targets = await prisma.campaign.findMany({
      where: {
        status: "PENDING_APPROVAL",
        draftSource: { in: ["AUTO_PROMOTION", "AUTO_FLOW_BRANCH", "AUTO_LLM"] },
      },
      select: { id: true },
    });

    // Drop variants first since Campaign has no cascade on CampaignVariant.
    await prisma.campaignVariant.deleteMany({
      where: { campaignId: { in: targets.map((t) => t.id) } },
    });
    const { count } = await prisma.campaign.deleteMany({
      where: { id: { in: targets.map((t) => t.id) } },
    });

    return NextResponse.json({ ok: true, deleted: count });
  } catch (e) {
    console.error("[DELETE /api/campaigns/auto-drafts] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "delete failed",
    }, { status: 500 });
  }
}
