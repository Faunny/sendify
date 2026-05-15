// Render pipeline.
//
// Compiles a CampaignVariant's MJML to inlined cross-client HTML and stores the snapshot
// + a hash on the variant. The hash is what we record on every `Send` row so we can audit
// "exactly what email did customer X receive" without storing 6MB of HTML per recipient.

import { prisma } from "../db";
import { personalize, renderMjml } from "../mjml";

export async function renderVariant(campaignId: string, language: string): Promise<{ htmlHash: string; bytes: number }> {
  const variant = await prisma.campaignVariant.findUnique({
    where: { campaignId_language: { campaignId, language } },
  });
  if (!variant) throw new Error(`variant missing for ${campaignId}/${language}`);

  const { html, hash, errors } = renderMjml(variant.mjml);
  // MJML warnings used to be dev-only — that silenced cross-client rendering
  // issues in production where they matter most. Now they ALWAYS log so we
  // can spot template regressions from server logs (audit fix).
  if (errors.length > 0) {
    console.warn(`[render] ${campaignId}/${language} MJML warnings (${errors.length}):`, errors.slice(0, 5));
  }

  await prisma.campaignVariant.update({
    where: { id: variant.id },
    data: { htmlSnapshot: html, htmlHash: hash },
  });

  return { htmlHash: hash, bytes: Buffer.byteLength(html, "utf8") };
}

// Per-recipient personalization happens at send time, not render time, so the snapshot
// stays single-canonical (great for audits and re-sends).
export async function personalizeForRecipient(args: {
  campaignId: string;
  language: string;
  context: Record<string, string>;
}): Promise<string> {
  const variant = await prisma.campaignVariant.findUnique({
    where: { campaignId_language: { campaignId: args.campaignId, language: args.language } },
  });
  if (!variant?.htmlSnapshot) throw new Error(`html snapshot missing for ${args.campaignId}/${args.language}`);
  return personalize(variant.htmlSnapshot, args.context);
}
