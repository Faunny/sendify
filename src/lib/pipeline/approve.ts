// Approval orchestrator — the entry point when a reviewer clicks "Approve & schedule".
//
// Pipeline:
//   1. Lock the campaign to PENDING → APPROVED (atomic, idempotent)
//   2. Translate every (sourceLang → targetLang) pair · DeepL with cache · upsert variants
//   3. Render every variant's MJML to HTML · snapshot hash on the variant
//   4. Resolve the final audience (segments ∪ - suppressions - app-recent - consent)
//   5. Bulk-insert Send rows in QUEUED state
//   6. Enqueue per-recipient SendJob in BullMQ — rate-limited by SES_RATE_PER_SECOND
//   7. Transition Campaign → SENDING when the queue starts draining (handled by worker)
//
// Idempotent: re-running on an already-APPROVED campaign skips already-rendered variants
// and doesn't double-enqueue Send rows (createMany skipDuplicates). Safe to retry if a
// step fails halfway.

import { prisma } from "../db";
import { resolveAudience, createSendLedger, type Recipient } from "../audience";
import { translateVariant } from "./translate";
import { renderVariant } from "./render";
import { cancelCampaignSends, enqueueSend, type SendJob } from "../queue";
import { capByWarmup, dailySendCap, warmupStage } from "../warmup";

export type ApproveResult = {
  campaignId: string;
  languages: string[];
  recipients: number;
  byLanguage: Record<string, number>;
  dropped: { consent: number; suppressed: number; appRecent: number; duplicate: number };
  enqueued: number;
  warmup: { stage: number | "warmed"; dailyCap: number; deferred: number };
  estimatedFinishAt: Date;
};

export async function approveCampaign(args: {
  campaignId: string;
  approverId: string;
  comment?: string;
  targetLanguages: string[]; // BCP-47 codes to fan out to
}): Promise<ApproveResult> {
  const { campaignId, approverId, comment, targetLanguages } = args;

  // ── 1) Atomic transition + approval record ────────────────────────────────
  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!c) throw new Error("campaign not found");
    if (c.status !== "PENDING_APPROVAL" && c.status !== "DRAFT") {
      throw new Error(`campaign already ${c.status}`);
    }
    await tx.approval.create({
      data: { campaignId, approverId, status: "approved", comment },
    });
    return tx.campaign.update({
      where: { id: campaignId },
      data: { status: "APPROVED" },
      include: { store: true, template: true, sender: true },
    });
  });

  const sourceLanguage = campaign.store.defaultLanguage;
  const baseMjml = campaign.template?.mjml ?? "<mjml><mj-body><mj-section><mj-column><mj-text>Empty</mj-text></mj-column></mj-section></mj-body></mjml>";

  // ── 2) Translate every target language ────────────────────────────────────
  await Promise.all(
    targetLanguages.map((lang) =>
      translateVariant({
        campaignId,
        sourceLanguage,
        targetLanguage: lang,
        fields: { subject: campaign.subject, preheader: campaign.preheader ?? "", mjml: baseMjml },
      })
    )
  );

  // ── 3) Render every variant ───────────────────────────────────────────────
  const htmlHashByLanguage: Record<string, string> = {};
  for (const lang of targetLanguages) {
    const { htmlHash } = await renderVariant(campaignId, lang);
    htmlHashByLanguage[lang] = htmlHash;
  }

  // ── 4) Resolve audience ───────────────────────────────────────────────────
  const audience = await resolveAudience({
    storeId: campaign.storeId,
    segmentIds: campaign.segmentIds,
    excludeAppRecent: campaign.excludeAppRecent,
    appSuppressionHours: campaign.appSuppressionHours,
  });

  // ── 4.5) Apply sender warm-up cap ─────────────────────────────────────────
  // If the sender is still ramping (warmupStartedAt set and within the 14-day window),
  // cap the audience at today's warm-up budget. Deferred recipients stay in PENDING_APPROVAL
  // for a follow-up send tomorrow when the next ramp stage opens more capacity.
  const now = new Date();
  const todaysCap = dailySendCap(campaign.sender, now);
  const stage = warmupStage(campaign.sender, now);
  const { allowed, deferred } = capByWarmup(audience.recipients, campaign.sender, now);
  if (deferred.length > 0) {
    console.warn(
      `[approve] warm-up cap applied for ${campaign.sender.fromEmail}: ` +
      `${allowed.length}/${audience.recipients.length} can send today (stage ${stage}, cap ${todaysCap}). ` +
      `${deferred.length} deferred to tomorrow's ramp.`
    );
  }

  // ── 5) Ledger ─────────────────────────────────────────────────────────────
  const ledgerCount = await createSendLedger({
    campaignId,
    recipients: allowed,
    htmlHashByLanguage,
  });

  // ── 6) Enqueue send jobs ──────────────────────────────────────────────────
  // We do this in batches of 1000 to avoid Redis pipeline pressure on huge audiences.
  const sendRows = await prisma.send.findMany({
    where: { campaignId, status: "QUEUED" },
    select: { id: true, customerId: true, language: true, htmlHash: true },
  });
  const recipientByCustomerId: Map<string, Recipient> = new Map(
    audience.recipients.map((r) => [r.customerId, r])
  );
  const variants = await prisma.campaignVariant.findMany({ where: { campaignId } });
  const variantByLang: Map<string, string> = new Map(variants.map((v) => [v.language, v.id]));

  const jobs: { name: string; data: SendJob }[] = [];
  for (const s of sendRows) {
    const r = recipientByCustomerId.get(s.customerId);
    if (!r) continue;
    const variantId = variantByLang.get(s.language);
    if (!variantId || !s.htmlHash) continue;
    jobs.push({
      name: "send",
      data: {
        campaignId,
        variantId,
        sendId: s.id,
        customerId: s.customerId,
        toEmail: r.email,
        toName: [r.firstName, r.lastName].filter(Boolean).join(" ") || undefined,
        language: s.language,
        htmlHash: s.htmlHash,
        context: {
          first_name: r.firstName ?? "",
          last_name:  r.lastName ?? "",
          unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?t=${encodeURIComponent(r.email)}`,
        },
      },
    });
  }

  // pg-boss `insert` is bulk-friendly; we still chunk for Postgres parameter limits.
  for (let i = 0; i < jobs.length; i += 1000) {
    await enqueueSend(jobs.slice(i, i + 1000).map((j) => j.data));
  }

  // ── 7) Move to SENDING ────────────────────────────────────────────────────
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  const ratePerSecond = parseInt(process.env.SES_RATE_PER_SECOND ?? "14", 10);
  const estimatedFinishAt = new Date(Date.now() + (jobs.length / ratePerSecond) * 1000);

  return {
    campaignId,
    languages: targetLanguages,
    recipients: ledgerCount,
    byLanguage: audience.byLanguage,
    dropped: audience.dropped,
    enqueued: jobs.length,
    warmup: { stage, dailyCap: todaysCap, deferred: deferred.length },
    estimatedFinishAt,
  };
}

// Cancel a sending or scheduled campaign. Drains the queue + flips the campaign + remaining
// Send rows to CANCELLED. Already-sent rows stay SENT (you can't unsend).
export async function cancelCampaign(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "CANCELLED" },
  });
  // Mark queued rows as cancelled. SENT/DELIVERED/etc. stay as-is.
  await prisma.send.updateMany({
    where: { campaignId, status: "QUEUED" },
    data:  { status: "FAILED", errorMessage: "campaign cancelled" },
  });
  // Drain pg-boss of any queued sends for this campaign. Already-active jobs see the
  // FAILED status set above on Send and short-circuit inside the worker.
  await cancelCampaignSends(campaignId);
}
