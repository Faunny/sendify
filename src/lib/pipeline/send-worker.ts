// Send worker — pops jobs from the `sendify.send` queue (pg-boss) and calls SES.
//
// Run with `npm run worker`. Single process handles ~50 emails/sec out of the box;
// run multiple instances if you push past 100/sec.
//
// On success: update Send.status → SENT and record messageId. SES later pushes engagement
// events via SNS → /api/ses/events which transitions DELIVERED → OPENED → CLICKED.
// On failure: pg-boss retries with backoff. After max attempts the row stays FAILED.

import { getBoss, QUEUES, SES_RATE_PER_SECOND, type SendJob } from "../queue";
import { prisma } from "../db";
import { sendEmail } from "../ses";
import { personalizeForRecipient } from "./render";

export async function startSendWorker() {
  const boss = await getBoss();

  // Token-bucket-ish rate limiter: process N jobs, wait, repeat.
  const teamSize = SES_RATE_PER_SECOND;
  const batchSize = Math.max(1, Math.floor(teamSize / 2));

  await boss.work(
    QUEUES.send,
    { teamSize, teamConcurrency: 1, batchSize },
    async (jobs: { data: SendJob; id: string }[]) => {
      // pg-boss passes an array when batchSize > 1.
      const arr = Array.isArray(jobs) ? jobs : [jobs];
      await Promise.all(arr.map(async (job) => {
        const j = job.data;
        try {
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
        } catch (e) {
          // pg-boss will retry based on the queue's retry policy; here we just log and let it.
          console.warn(`[send-worker] failed: ${j.toEmail}`, e instanceof Error ? e.message : e);
          throw e;
        }
      }));
    },
  );

  return boss;
}
