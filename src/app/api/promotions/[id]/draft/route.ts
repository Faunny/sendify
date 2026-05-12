// POST /api/promotions/[id]/draft
//
// Triggers an auto-draft for the given promotion. Body: { storeId: string }.
// Used by:
// - the "Auto-draft" button on /calendar
// - the hourly cron worker that scans the lead-time window
// - the upstream webhook (after upserting, it can also POST here to draft immediately)
//
// Response: the generated CampaignDraft. The route persists it as a Campaign in
// `PENDING_APPROVAL` so it appears in /approvals.

import { NextResponse } from "next/server";
import { draftCampaignFromPromotion } from "@/lib/autodraft";
import { PRODUCTS, PROMOTIONS, STORES } from "@/lib/mock";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const storeId: string | undefined = body.storeId;
  if (!storeId) return NextResponse.json({ ok: false, error: "storeId required" }, { status: 400 });

  const promotion = PROMOTIONS.find((p) => p.id === id);
  if (!promotion) return NextResponse.json({ ok: false, error: "promotion not found" }, { status: 404 });
  const store = STORES.find((s) => s.id === storeId);
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

  const draft = draftCampaignFromPromotion({ promotion, store, products: PRODUCTS });

  // Production:
  //   const campaign = await prisma.campaign.create({
  //     data: {
  //       storeId, promotionId, name: draft.name, subject: draft.subject, preheader: draft.preheader,
  //       senderId: defaultSenderForStore(storeId), status: "PENDING_APPROVAL",
  //       scheduledFor: draft.scheduledFor,
  //       estimatedCost: draft.estimatedCost,
  //       estimatedRecipients: draft.estimatedRecipients,
  //       draftSource: draft.draftSource,
  //       draftReason: draft.draftReason,
  //       draftLlmPrompt: draft.draftLlmPrompt,
  //     },
  //   });
  //   await enqueueTranslationJob(campaign.id, draft.languages);
  //   await enqueueBannerGeneration(campaign.id, draft.bannerPrompt);

  return NextResponse.json({
    ok: true,
    draft: {
      name: draft.name,
      subject: draft.subject,
      preheader: draft.preheader,
      market: draft.market,
      languages: draft.languages,
      scheduledFor: draft.scheduledFor,
      estimatedRecipients: draft.estimatedRecipients,
      estimatedCost: draft.estimatedCost,
      bannerPrompt: draft.bannerPrompt,
      draftReason: draft.draftReason,
      blocks: draft.document.blocks.length,
    },
    note: "dev mode: not persisted — pipe through prisma.campaign.create() in production",
  });
}
