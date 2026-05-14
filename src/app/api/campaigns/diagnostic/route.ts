// GET /api/campaigns/diagnostic
//
// Quick admin-only readout of what actually lives in the Campaign table —
// counts by status + the 10 most-recently-created rows with their key fields.
// Used to debug "I created drafts but I can't see them anywhere".

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const [counts, recent, total, totalByStore] = await Promise.all([
    prisma.campaign.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, name: true, subject: true, status: true,
        storeId: true, senderId: true, scheduledFor: true,
        draftSource: true, draftReason: true, createdAt: true,
        store: { select: { slug: true, name: true } },
      },
    }).catch(() => []),
    prisma.campaign.count().catch(() => 0),
    prisma.campaign.groupBy({ by: ["storeId"], _count: { _all: true } }).catch(() => []),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    countsByStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    countsByStore: Object.fromEntries(totalByStore.map((c) => [c.storeId, c._count._all])),
    recent: recent.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      scheduledFor: c.scheduledFor?.toISOString() ?? null,
    })),
  });
}
