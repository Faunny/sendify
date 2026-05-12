// Send worker — pops jobs from the `send` queue and calls SES.
//
// Concurrency is bounded by SES_RATE_PER_SECOND × the rate window we set on the BullMQ
// limiter (BullMQ enforces both global rate and per-worker concurrency). A new SES account
// starts at 14/sec; once warmed and approved by AWS, request a 200/sec quota and bump the
// env var without redeploying the worker code.
//
// On success: update Send.status → SENT and record messageId. SES will later push
// engagement events (Delivery, Open, Click) via SNS → /api/ses/events, which transitions
// the row through DELIVERED → OPENED → CLICKED.
//
// On failure: BullMQ retries with exponential backoff. If all attempts fail, the worker
// flips Send.status → FAILED with the SES error message recorded.

import { Worker, type Job } from "bullmq";
import { type SendJob, getRedis, SES_RATE_PER_SECOND } from "../queue";
import { prisma } from "../db";
import { sendEmail } from "../ses";
import { personalizeForRecipient } from "./render";

export function startSendWorker() {
  const worker = new Worker<SendJob>(
    "send",
    async (job: Job<SendJob>) => {
      const j = job.data;

      // Last-chance suppression check (catches bounces/complaints that landed between
      // audience resolution and send time, sometimes minutes apart for large campaigns).
      const suppressed = await prisma.suppression.findUnique({ where: { email: j.toEmail } });
      if (suppressed) {
        await prisma.send.update({
          where: { id: j.sendId },
          data: { status: "SUPPRESSED_CONSENT", errorMessage: `suppressed: ${suppressed.reason}` },
        });
        return { skipped: true };
      }

      // Materialize the recipient-personalized HTML from the variant snapshot.
      const html = await personalizeForRecipient({
        campaignId: j.campaignId,
        language:   j.language,
        context:    j.context,
      });

      // Look up the sender identity from the campaign.
      const campaign = await prisma.campaign.findUnique({
        where: { id: j.campaignId },
        include: { sender: true, variants: { where: { language: j.language } } },
      });
      if (!campaign) throw new Error(`campaign gone: ${j.campaignId}`);
      const variant = campaign.variants[0];
      if (!variant) throw new Error(`variant gone: ${j.campaignId}/${j.language}`);

      // Send.
      const result = await sendEmail({
        from: `${campaign.sender.fromName} <${campaign.sender.fromEmail}>`,
        replyTo: campaign.sender.replyTo ?? undefined,
        to: j.toName ? `${j.toName} <${j.toEmail}>` : j.toEmail,
        subject: variant.subject,
        html,
        configurationSet: process.env.SES_CONFIGURATION_SET,
        tags: [
          { name: "campaign_id", value: j.campaignId },
          { name: "language",    value: j.language },
          { name: "variant_id",  value: j.variantId },
        ],
        listUnsubscribe: {
          url:    `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?t=${encodeURIComponent(j.toEmail)}`,
          mailto: campaign.sender.replyTo ?? undefined,
        },
      });

      await prisma.send.update({
        where: { id: j.sendId },
        data: { status: "SENT", sentAt: new Date(), messageId: result.messageId },
      });

      return { messageId: result.messageId };
    },
    {
      connection: getRedis(),
      concurrency: 50,
      limiter: { max: SES_RATE_PER_SECOND, duration: 1_000 },
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 5)) return;
    // Final failure — flip the row to FAILED so the dashboard reflects it.
    await prisma.send.update({
      where: { id: job.data.sendId },
      data: { status: "FAILED", errorMessage: err.message },
    }).catch(() => { /* swallow if row is gone */ });
  });

  worker.on("error", (err) => {
    console.error("[send-worker]", err.message);
  });

  return worker;
}
