// Translation pipeline.
//
// Given the source-language MJML + subject + preheader of a campaign, produce a
// CampaignVariant row for each target language. Each field flows through:
//
//   cache lookup → DeepL → glossary substitution → optional GPT-4 review for tone
//
// The cache is the cost lever. At 22 languages × 2000 chars per campaign that's
// ~44k chars uncached = ~$1.10 in DeepL spend. At 70% hit rate it drops to ~$0.33.
// Per-language cache lives in the `Translation` table keyed on (sourceHash, lang, tone).

import { prisma } from "../db";
import { translate as deeplTranslate, sourceHash } from "../deepl";

export type TranslatePayload = {
  campaignId: string;
  sourceLanguage: string;
  targetLanguage: string;
  fields: {
    subject: string;
    preheader: string;
    mjml: string;          // source MJML; we translate string nodes inside it
  };
  tone?: "default" | "formal" | "informal" | "promotional";
};

export async function translateVariant(p: TranslatePayload) {
  // Subject + preheader translate directly.
  const [subject, preheader] = await Promise.all([
    deeplTranslate({ text: p.fields.subject,   targetLang: p.targetLanguage, tone: p.tone, sourceLang: p.sourceLanguage }),
    deeplTranslate({ text: p.fields.preheader, targetLang: p.targetLanguage, tone: p.tone, sourceLang: p.sourceLanguage }),
  ]);

  // For MJML, we only translate visible text nodes — anything inside mj-button/mj-text/etc.
  // The placeholder regex below is a pragmatic version; a real impl uses an MJML parser.
  const mjml = await translateMjmlTextNodes(p.fields.mjml, p.sourceLanguage, p.targetLanguage, p.tone);

  // Upsert the variant row. `htmlSnapshot` is filled by the render pipeline next.
  await prisma.campaignVariant.upsert({
    where: { campaignId_language: { campaignId: p.campaignId, language: p.targetLanguage } },
    update: { subject, preheader, mjml },
    create: { campaignId: p.campaignId, language: p.targetLanguage, subject, preheader, mjml },
  });

  return { subject, preheader, mjml };
}

// Walks MJML and translates the text inside <mj-text>, <mj-button>, <mj-title>, <mj-preview>
// while preserving inline HTML markup. Each substring is independently cache-hit-checked.
async function translateMjmlTextNodes(mjml: string, sourceLang: string, targetLang: string, tone: TranslatePayload["tone"]): Promise<string> {
  if (targetLang === sourceLang) return mjml;
  // Capture text inside the translatable MJML tags. Group 1 = open tag + attrs, 2 = inner text.
  const re = /(<(mj-text|mj-button|mj-title|mj-preview)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi;
  const segments: Array<{ raw: string; translated?: string }> = [];
  let last = 0;
  const out: string[] = [];

  for (const m of mjml.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(mjml.slice(last, start));
    const inner = m[3];
    // Skip pure-whitespace or token-only fragments.
    const stripped = inner.replace(/<[^>]+>/g, "").trim();
    if (!stripped) {
      out.push(m[0]);
      last = start + m[0].length;
      continue;
    }
    // Cache-hit check happens inside deeplTranslate.
    const translated = await deeplTranslate({ text: stripped, targetLang, sourceLang, tone });
    // Naively replace the visible text. For complex nested markup a proper DOM walker is needed.
    const replaced = m[0].replace(stripped, translated);
    out.push(replaced);
    segments.push({ raw: stripped, translated });
    last = start + m[0].length;
  }
  if (last < mjml.length) out.push(mjml.slice(last));
  void sourceHash; // referenced for completeness — kept for cache key parity
  return out.join("");
}
