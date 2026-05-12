// GET /api/campaigns/[id]/progress
//
// Returns the live progress of a sending campaign — counts by status from the `Send`
// ledger plus the BullMQ queue depth. The /campaigns/[id] page polls this every 2s
// while the campaign is in the SENDING state.
//
// We could SSE-stream this instead of polling, but the polling approach handles client
// reconnects cleanly and avoids a long-lived Node connection per active campaign. At
// ~1 request every 2s with low payload, polling is fine even at 20M/mo scale.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendQueue } from "@/lib/queue";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, scheduledFor: true, estimatedRecipients: true },
  });
  if (!campaign) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const grouped = await prisma.send.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: { _all: true },
  });
  const counts: Record<string, number> = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sent = (counts.SENT ?? 0) + (counts.DELIVERED ?? 0) + (counts.OPENED ?? 0) + (counts.CLICKED ?? 0);
  const queued = counts.QUEUED ?? 0;
  const failed = (counts.FAILED ?? 0) + (counts.BOUNCED ?? 0);

  // BullMQ depth (best-effort — if Redis is down we just skip these numbers).
  let waiting = 0;
  let active = 0;
  try {
    const q = sendQueue();
    waiting = await q.getWaitingCount();
    active  = await q.getActiveCount();
  } catch { /* redis offline */ }

  return NextResponse.json({
    ok: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      scheduledFor: campaign.scheduledFor,
      estimatedRecipients: campaign.estimatedRecipients,
    },
    progress: {
      total,
      sent,
      queued,
      failed,
      opened:    counts.OPENED ?? 0,
      clicked:   counts.CLICKED ?? 0,
      delivered: counts.DELIVERED ?? 0,
      suppressedConsent: counts.SUPPRESSED_CONSENT ?? 0,
      suppressedApp:     counts.SUPPRESSED_APP ?? 0,
      sentPct: total > 0 ? sent / total : 0,
    },
    queue: { waiting, active },
    serverTime: new Date().toISOString(),
  });
}
