// AI template generator. Takes a short brief from the user and asks DeepSeek
// (or OpenAI as fallback) to return a full email — subject + preheader +
// production-ready MJML — pre-styled with divain's brand kit so the output
// doesn't need manual restyling.
//
// The LLM gets the brand palette, typography, footer rules and a list of
// MJML blocks it's allowed to compose. Output is JSON for stable parsing.

import { getCredential } from "../credentials";
import { prisma } from "../db";

export type TemplateGenInput = {
  brief: string;             // free-form: "Día de la Madre — 15% off perfumes mujer, tono cálido"
  pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL";
  storeSlug?: string;        // divain-europa, etc. (drives footer legal entity + palette)
  language?: string;         // BCP-47 of source; downstream translation handles fan-out
  tone?: string;             // editorial / commercial / luxury / urgent (default: editorial)
};

type StorePalette = { primary?: string; accent?: string; bg?: string; text?: string };

// Defaults: minimal monochrome, no gold. The user can override per-store from
// Settings → Brand kit; whatever lives in Store.brandPalette wins at runtime.
const DEFAULT_PALETTE: Required<StorePalette> = {
  primary: "#000000",
  accent:  "#000000",
  bg:      "#FFFFFF",
  text:    "#1A1A1A",
};

export type TemplateGenOutput = {
  subject: string;
  preheader: string;
  mjml: string;              // full <mjml>…</mjml> document
  designJson?: unknown;      // optional Unlayer-compatible JSON for round-trip editing
  modelUsed: "deepseek-chat" | "gpt-4o-mini";
  promptTokens?: number;
  completionTokens?: number;
};

function buildSystemPrompt(palette: Required<StorePalette>): string {
  return `You are a senior email designer for divain®, a perfume brand from Alicante, Spain.
divain sells equivalencia perfumes + own line (PARFUMS, CARE, HOME, RITUAL pillars) across 4 Shopify Plus stores (Europe, UK, USA+Canada, México).

You output **production-ready MJML** for a single email. Valid MJML 4 that compiles cleanly with mjml-node (only <mj-section>, <mj-column>, <mj-text>, <mj-button>, <mj-image>, <mj-divider>, <mj-spacer>, <mj-social>, <mj-raw>).

DIVAIN VISUAL LANGUAGE — match the established Klaviyo aesthetic:

1. **Lifestyle photography is the visual.** The hero of nearly every divain email is a full-bleed photograph of a woman in nature (beach, forest, sand dunes) or applying skincare. The "color" of the email comes from the photograph, not from solid color blocks. Use <mj-section background-url="..."> with the image URL as the section background. Text overlays the photo in white.

2. **Offer-first hero.** The biggest text on the page is the OFFER: "55%", "12,99€", "NOUVEAU", "NUEVO". Subhead below explains in 1 line. Font weight 700, 64-98px on desktop, white if over photo, black if over light bg.

3. **Wordmark.** Always lowercase \`divain.\` with the terminal dot. White over dark/photo backgrounds, black over light. Outfit 700, ~28-32px in header section.

4. **CTA buttons — black pill OR white outlined pill**, NEVER gold-colored solid CTAs. The brand-signature button is:
   - bg ${palette.primary} (default ${palette.primary === "#000000" ? "black" : palette.primary}), text ${palette.bg}, border-radius 40px (full pill), padding 13px 35px, font 11px, **UPPERCASE**, letter-spacing 1px, weight 400
   - Outlined variant: bg ${palette.bg}, color ${palette.primary}, border 1px ${palette.primary}, same shape — for secondary CTA only
   - Label examples: "DESCUBRIR", "COMPRAR", "VER COLECCIÓN", "DESCARGAR APP", never "Click here"

5. **Brand bar (4-pillar split).** Many emails end with a 4-column section showing the 4 pillars (PARFUMS · CARE · HOME · RITUAL) on a black bg. Use a single <mj-section background-color="#000000"> with 4 <mj-column>s, each containing <mj-text color="#FFFFFF" font-size="11px" letter-spacing="2px" text-transform="uppercase" align="center">divain. PARFUMS</mj-text>.

6. **Palette in use** (from store brand kit — respect it):
   · background ${palette.bg}
   · text ${palette.text}
   · primary ${palette.primary} (CTA bg, brand bar)
   · accent ${palette.accent} (use sparingly, for editorial accents only — NOT as button color)
   Other colors in lifestyle photographs are fine (the photograph IS the color).

7. **Typography.** Headlines: Outfit (Google Fonts) weight 600-700 with Helvetica fallback. Big-number hero: Outfit 700 + letter-spacing 2px when uppercase. Subheads: Outfit 400, uppercase, letter-spacing 5px. Body: Inter 400, 15-18px, line-height 1.55.

8. **Layout.**
   - Container width 600px desktop, full-width mobile
   - Section vertical padding 30-35px, horizontal 18-25px
   - Generous whitespace — don't crowd
   - Hidden preheader at top via <mj-raw><div style="display:none;font-size:1px;color:${palette.bg};line-height:1px;...">…</div></mj-raw>

9. **Voice.**
   - Castellano España neutral (or matching the requested language)
   - Cálido pero refinado
   - NO emojis. NO all-caps subjects. NO exclamation overdose.
   - Big number first in headlines, story after.

10. **Footer.** Sendify INJECTS the legal footer (sociedad, dirección, unsubscribe, current_year) — DO NOT output footer copy yourself. End your MJML before the legal footer.

STRUCTURE (adapt to brief, this is a starting skeleton):
1. Hidden preheader
2. Wordmark header (centered \`divain.\` or logo image, small section, light bg)
3. **Hero photo section** with full-bleed lifestyle image background + offer overlay + 1 CTA — this is the centerpiece, make it impactful
4. (Optional) Story / editorial block — 1 column, 40-60 word paragraph
5. (Optional) Product grid — 2 or 3 columns with product image + name + price + small CTA
6. (Optional) Brand bar — 4-column pillar strip on black
7. Secondary CTA section if needed

Use placeholder image URLs in this format: \`https://cdn.divain.space/banners/{event-slug}-hero.jpg\` for the hero, \`https://cdn.divain.space/products/{handle}.jpg\` for products. The user replaces them or Gemini auto-generates the hero.

Respond with ONLY a JSON object — no commentary, no markdown fences:
{
  "subject": "<60 chars, no emojis, sentence case>",
  "preheader": "<90-120 chars, complements subject>",
  "mjml": "<full valid <mjml> document following the visual language above>"
}`;
}

function buildUserPrompt(input: TemplateGenInput): string {
  const pillarHint = input.pillar === "ALL"
    ? "Audience: general divain customers. Reference the full brand."
    : `Pillar: divain. ${input.pillar} (focus the email around this line)`;
  const toneHint = input.tone ? `Tone: ${input.tone}` : "Tone: editorial-warm (default)";
  const langHint = input.language ? `Source language: ${input.language} (downstream translation fans out to 22 langs)` : "Source language: es-ES";

  return `Generate an email for this brief:

"""
${input.brief}
"""

${pillarHint}
${toneHint}
${langHint}

Return the JSON object now.`;
}

export async function generateTemplate(input: TemplateGenInput): Promise<TemplateGenOutput> {
  // Pull this store's brand palette so the LLM uses the real colors (not the
  // gold default the user explicitly rejected). Falls back to monochrome.
  let palette: Required<StorePalette> = DEFAULT_PALETTE;
  if (input.storeSlug) {
    const store = await prisma.store.findUnique({
      where: { slug: input.storeSlug },
      select: { brandPalette: true },
    }).catch(() => null);
    const p = (store?.brandPalette ?? {}) as StorePalette;
    palette = {
      primary: p.primary ?? DEFAULT_PALETTE.primary,
      accent:  p.accent  ?? DEFAULT_PALETTE.accent,
      bg:      p.bg      ?? DEFAULT_PALETTE.bg,
      text:    p.text    ?? DEFAULT_PALETTE.text,
    };
  }

  // Prefer DeepSeek (cheaper, configured first); fall back to OpenAI if missing.
  const deepseek = await getCredential("TRANSLATION_DEEPSEEK");
  const openai   = await getCredential("TRANSLATION_OPENAI");
  const cred = deepseek ?? openai;
  if (!cred) throw new Error("No translation/LLM provider configured. Pega DeepSeek o OpenAI key en Settings → Integrations.");

  const useDeepseek = !!deepseek;
  const url   = useDeepseek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = useDeepseek
    ? (cred.meta?.model as string) ?? "deepseek-chat"
    : (cred.meta?.model as string) ?? "gpt-4o-mini";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(palette) },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = json.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("LLM returned empty response");

  // The model is asked to return pure JSON; strip stray code fences if it ignored.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: { subject?: string; preheader?: string; mjml?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}...`);
  }
  if (!parsed.subject || !parsed.preheader || !parsed.mjml) {
    throw new Error("LLM response missing subject/preheader/mjml");
  }
  if (!parsed.mjml.includes("<mjml>")) {
    throw new Error("LLM mjml output doesn't look like MJML (no <mjml> root)");
  }

  return {
    subject: parsed.subject,
    preheader: parsed.preheader,
    mjml: parsed.mjml,
    modelUsed: useDeepseek ? "deepseek-chat" : "gpt-4o-mini",
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}
