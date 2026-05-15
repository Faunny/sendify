// Send worker — pops jobs from the `sendify.send` queue (pg-boss) and calls SES.
//
// Two entry points:
//   1. startSendWorker()         — long-lived listener (used by `npm run worker`
//      on a dedicated host like Railway/Fly). Handles ~50 emails/sec out of
//      the box; run multiple instances if you push past 100/sec.
//   2. processSendBatch({ max }) — pulls a bounded chunk and returns. Used by
//      /api/cron/send-tick on Vercel where we don't have a long-lived
//      process; the cron ticks every minute and drains the queue in batches.
//
// On success: Send.status → SENT + messageId recorded. SES then pushes
// engagement events via SNS → /api/ses/events which transitions DELIVERED →
// OPENED → CLICKED.
// On failure: complete the job with a fail() so pg-boss retries with backoff.

import { getBoss, QUEUES, SES_RATE_PER_SECOND, type SendJob } from "../queue";
import { prisma } from "../db";
import { sendEmail } from "../ses";
import { personalizeForRecipient } from "./render";

// ── Single-job processor — the unit of work both entry points share. ───────

async function processOneSendJob(j: SendJob): Promise<void> {
  // Last-chance suppression check.
  const suppressed = await prisma.suppression.findUnique({ where: { email: j.toEmail } });
  if (suppressed) {
    await prisma.send.update({
      where: { id: j.sendId },
      data: { status: "SUPPRESSED_CONSENT", errorMessage: `suppressed: ${suppressed.reason}` },
    });
    return;
  }

  // Personalize the variant's HTML snapshot.
  const html = await personalizeForRecipient({
    campaignId: j.campaignId,
    language: j.language,
    context: j.context,
  });

  // Fetch the campaign + sender + variant.
  const campaign = await prisma.campaign.findUnique({
    where: { id: j.campaignId },
    include: { sender: true, variants: { where: { language: j.language } } },
  });
  if (!campaign || campaign.status === "CANCELLED") {
    await prisma.send.update({
      where: { id: j.sendId },
      data: { status: "FAILED", errorMessage: "campaign cancelled or missing" },
    });
    return;
  }
  if (!campaign.sender) {
    await prisma.send.update({
      where: { id: j.sendId },
      data: { status: "FAILED", errorMessage: "campaign has no sender configured" },
    });
    return;
  }
  const variant = campaign.variants[0];
  if (!variant) throw new Error(`variant gone: ${j.campaignId}/${j.language}`);

  const result = await sendEmail({
    from: `${campaign.sender.fromName} <${campaign.sender.fromEmail}>`,
    replyTo: campaign.sender.replyTo ?? undefined,
    to: j.toName ? `${j.toName} <${j.toEmail}>` : j.toEmail,
    subject: variant.subject,
    html,
    configurationSet: process.env.SES_CONFIGURATION_SET,
    tags: [
      { name: "campaign_id", value: j.campaignId },
      { name: "language", value: j.language },
      { name: "variant_id", value: j.variantId },
    ],
    listUnsubscribe: {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?t=${encodeURIComponent(j.toEmail)}`,
      mailto: campaign.sender.replyTo ?? undefined,
    },
  });

  await prisma.send.update({
    where: { id: j.sendId },
    data: { status: "SENT", sentAt: new Date(), messageId: result.messageId },
  });
}

// ── Vercel cron entry point: bounded batch, returns within ~3-4 min. ──────

export type SendBatchResult = {
  fetched: number;
  sent: number;
  failed: number;
  suppressed: number;
  errors: string[];
};

// Pull up to `max` queued jobs from pg-boss and process them in parallel
// (capped at `concurrency` in-flight to respect SES rate limits). Each job
// is completed or failed on pg-boss so retries work normally.
export async function processSendBatch({ max = 100, concurrency = SES_RATE_PER_SECOND ?? 14 } = {}): Promise<SendBatchResult> {
  const boss = await getBoss();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs: Array<{ id: string; data: SendJob }> = await boss.fetch(QUEUES.send, max).catch(() => [] as any);
  if (!jobs || jobs.length === 0) {
    return { fetched: 0, sent: 0, failed: 0, suppressed: 0, errors: [] };
  }

  const result: SendBatchResult = {
    fetched: jobs.length, sent: 0, failed: 0, suppressed: 0, errors: [],
  };

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= jobs.length) return;
      const job = jobs[i];
      try {
        await processOneSendJob(job.data);
        await boss.complete(job.id).catch(() => {});
        // Count from Send row state — processOneSendJob may have written
        // SUPPRESSED_CONSENT instead of SENT.
        const row = await prisma.send.findUnique({ where: { id: job.data.sendId }, select: { status: true } }).catch(() => null);
        if (row?.status === "SUPPRESSED_CONSENT") result.suppressed++;
        else if (row?.status === "SENT") result.sent++;
        else if (row?.status === "FAILED") result.failed++;
      } catch (e) {
        result.failed++;
        const msg = e instanceof Error ? e.message.slice(0, 200) : "send failed";
        result.errors.push(`${job.data.toEmail}: ${msg}`);
        await boss.fail(job.id, { message: msg }).catch(() => {});
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  return result;
}

// ── Long-lived worker (Railway / Fly host). ───────────────────────────────

export async function startSendWorker() {
  const boss = await getBoss();
  const teamSize = SES_RATE_PER_SECOND;
  const batchSize = Math.max(1, Math.floor(teamSize / 2));

  await boss.work(
    QUEUES.send,
    { teamSize, teamConcurrency: 1, batchSize },
    async (jobs: { data: SendJob; id: string }[]) => {
      const arr = Array.isArray(jobs) ? jobs : [jobs];
      await Promise.all(arr.map(async (job) => {
        try { await processOneSendJob(job.data); }
        catch (e) {
          console.warn(`[send-worker] failed: ${job.data.toEmail}`, e instanceof Error ? e.message : e);
          throw e;
        }
      }));
    },
  );

  return boss;
}
