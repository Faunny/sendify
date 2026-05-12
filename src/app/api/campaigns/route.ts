// POST /api/campaigns
// Creates a new Campaign in DRAFT state. Called by the New Campaign wizard
// (/campaigns/new) when the user clicks "Guardar draft".

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const { storeId, senderId, name, subject, preheader, excludeAppRecent, estimatedRecipients, estimatedCost } = body as {
    storeId: string; senderId: string; name: string; subject: string; preheader?: string;
    languages?: string[]; excludeAppRecent?: boolean; estimatedRecipients?: number; estimatedCost?: number;
  };
  // `languages` is accepted in the body for future fan-out; not stored on Campaign directly —
  // CampaignVariant rows are created at approve-time by the translation pipeline.

  if (!storeId || !senderId || !name || !subject) {
    return NextResponse.json({ ok: false, error: "missing required fields (storeId, senderId, name, subject)" }, { status: 400 });
  }

  try {
    const c = await prisma.campaign.create({
      data: {
        storeId,
        senderId,
        name,
        subject,
        preheader: preheader ?? null,
        status: "DRAFT",
        excludeAppRecent: excludeAppRecent ?? true,
        estimatedRecipients: estimatedRecipients ?? 0,
        estimatedCost: estimatedCost ?? 0,
        segmentIds: [],
        draftSource: "MANUAL",
      },
    });
    return NextResponse.json({ ok: true, id: c.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create failed";
    // Surface "DB not connected" cleanly so the UI can show a friendly message instead of 500.
    if (/connect|ECONNREFUSED|placeholder|DATABASE_URL/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "database not connected — configure DATABASE_URL in Vercel and redeploy" },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

