// AI template generator. Takes a short brief from the user and asks DeepSeek
// (or OpenAI as fallback) to return a full email — subject + preheader +
// production-ready MJML — pre-styled with divain's brand kit so the output
// doesn't need manual restyling.
//
// The LLM gets the brand palette, typography, footer rules and a list of
// MJML blocks it's allowed to compose. Output is JSON for stable parsing.

import { getCredential } from "../credentials";
import { prisma } from "../db";
import { generateBanner } from "../gemini";
import { LAYOUT_LIBRARY, FEW_SHOT_EXAMPLES } from "./template-patterns";

export type TemplateGenInput = {
  brief: string;             // free-form: "Día de la Madre — 15% off perfumes mujer, tono cálido"
  pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL";
  storeSlug?: string;        // divain-europa, etc. (drives footer legal entity + palette)
  language?: string;         // BCP-47 of source; downstream translation handles fan-out
  tone?: string;             // editorial / commercial / luxury / urgent (default: editorial)
  generateBanner?: boolean;  // run Gemini after MJML and substitute the hero URL (default: true if Gemini key exists)
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

type ProductHint = {
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  imageUrl: string | null;
  price: string | null;
  comparePrice: string | null;
  currency: string | null;
};

// Pull a small relevant sample of ACTIVE products for the store so the LLM can
// reference real photos / names / prices in the MJML — instead of inventing
// placeholders. Filter by pillar (productType / tags) when one is given.
async function loadProductHints(storeSlug: string | undefined, pillar: string | undefined): Promise<ProductHint[]> {
  if (!storeSlug) return [];
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, defaultLanguage: true, countryCode: true, currency: true },
  });
  if (!store) return [];

  // Pillar → product-type / tag matching. divain uses tags + productType to
  // categorize: PARFUMS, CARE, HOME, RITUAL. Match loosely.
  const pillarFilter = pillar && pillar !== "ALL" ? {
    OR: [
      { productType: { contains: pillar, mode: "insensitive" as const } },
      { tags: { has: pillar.toLowerCase() } },
      { tags: { has: pillar } },
    ],
  } : {};

  const products = await prisma.product.findMany({
    where: { storeId: store.id, status: "active", ...pillarFilter },
    orderBy: { shopifyUpdatedAt: "desc" },
    take: 8,
    select: {
      handle: true, title: true, vendor: true, productType: true, imageUrl: true,
      variants: {
        take: 1,
        select: {
          prices: {
            where: { market: store.countryCode },
            take: 1,
            select: { price: true, comparePrice: true, currency: true },
          },
        },
      },
    },
  }).catch(() => []);

  return products.map((p) => ({
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    productType: p.productType,
    imageUrl: p.imageUrl,
    price: p.variants[0]?.prices[0]?.price?.toString() ?? null,
    comparePrice: p.variants[0]?.prices[0]?.comparePrice?.toString() ?? null,
    currency: p.variants[0]?.prices[0]?.currency ?? store.currency,
  }));
}

function buildProductContextBlock(products: ProductHint[]): string {
  if (products.length === 0) return "";
  const lines = products.map((p, i) => {
    const priceStr = p.price ? `${p.price} ${p.currency}` : "—";
    const compareStr = p.comparePrice ? ` (was ${p.comparePrice})` : "";
    return `${i + 1}. ${p.title} (${p.handle}) · ${p.productType ?? "—"} · ${priceStr}${compareStr} · image: ${p.imageUrl ?? "(no image)"}`;
  }).join("\n");
  return `\nREAL CATALOG SAMPLE (active products from this store, use these exact image URLs + names + prices when the chosen layout needs products — DO NOT invent product names or placeholder URLs):\n${lines}\n`;
}

export type TemplateGenOutput = {
  subject: string;
  preheader: string;
  mjml: string;              // full <mjml>…</mjml> document
  layoutPattern?: string;    // which pattern from the library was chosen
  bannerPrompt?: string;     // prompt fed to Gemini
  bannerAssetId?: string;    // populated when Gemini generation succeeded
  bannerUrl?: string;        // public URL of the generated hero
  designJson?: unknown;      // optional Unlayer-compatible JSON for round-trip editing
  modelUsed: string;
  promptTokens?: number;
  completionTokens?: number;
};

function buildPatternLibraryBlock(): string {
  return LAYOUT_LIBRARY.map((p, i) => `${i + 1}. **${p.id}** — ${p.name}
   when to use: ${p.whenToUse}
   tone: ${p.emotionalTone}
   visual: ${p.visualSignature}
   structure:${p.structureHint.split("\n").map((l) => `   ${l}`).join("\n")}
   canonical CTA label: "${p.ctaLabel}"
   example subject: "${p.exampleSubject}"`).join("\n\n");
}

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

REAL PRODUCT CATALOG RULES:
- A list of REAL products from the store is included at the bottom of the user
  prompt (if the store has been synced). When the chosen layout has product
  slots (product-grid-editorial, premium-launch, brand-anthology), USE those
  products: exact title, exact handle, exact image URL from the catalog, exact
  price.
- DO NOT invent product names. DO NOT use placeholder cdn.divain.space URLs
  when real product image URLs are provided.

ASSET URL DISCIPLINE — no broken images:
- If the user prompt does NOT include a "BANNER ASSET URL:" line and the
  catalog block is empty, DO NOT emit <mj-image src="https://cdn.divain.space/..."
  /> tags pointing to URLs that don't exist. Those render as broken images.
- Instead, use a "type-only hero" approach:
  · For lifestyle-hero pattern: replace background-url with a solid color
    section background (palette.primary or text on bg), and write the offer
    in big Outfit type — the design still reads, just without the photo.
  · For product-grid-editorial without catalog: use 3 <mj-text> blocks with
    product names from the brief, no <mj-image>.
  · For premium-launch without catalog: pure typographic hero with the
    product name in Outfit 36-44px, no image.
- The brand wordmark in the header: always use <mj-text> with "divain."
  in Outfit weight 700, NEVER an <mj-image> pointing at a fictional logo URL.
- If a "BANNER ASSET URL:" line IS present in the prompt, use that exact URL
  for the hero — that's the real Gemini-generated banner.

PATTERN LIBRARY — pick ONE that fits the brief, then improvise on top of it.
You MUST NOT just fill a generic skeleton. Every email starts by reading the
brief, deciding which pattern best embodies the moment, and then composing the
MJML in that pattern's specific visual language. Two emails for different
occasions should look visibly DIFFERENT, not slight variations of the same
template.

${buildPatternLibraryBlock()}

DECISION HEURISTIC:
- Hard sell with big discount → big-number-hero OR countdown-urgency
- Mother's Day / Father's Day / Women's Day → lifestyle-hero
- Gift guides / curation / "top 5" → product-grid-editorial
- App promo → app-promo-gradient
- Welcome series / brand storytelling → brand-anthology
- 24h flash / "ends tonight" → countdown-urgency
- New SKU launch (RITUAL edition etc) → premium-launch
- Win-back inactive customers → winback-empathic

Once you pick, hold to that pattern's typography scale, color use and structure.
DON'T mix patterns — pure lifestyle-hero looks nothing like big-number-hero;
keep the chosen one CLEAN.

FEW-SHOT EXAMPLES of what good output looks like (these are real, working MJMLs):
${FEW_SHOT_EXAMPLES}

Respond with ONLY a JSON object — no commentary, no markdown fences:
{
  "layoutPattern": "<one of: ${LAYOUT_LIBRARY.map((p) => p.id).join(" | ")}>",
  "bannerPrompt": "<50-80 word prompt for Gemini image gen. Describe ONLY what is in the photograph: subject, setting, mood, lighting, colors, composition. The image will be reused across 22 language translations, so it must contain ZERO text/letters/numbers/prices/percentages/dates/logos/watermarks/signage of any kind — those go in the MJML on top. Aspect 3:2. Match divain's aesthetic — refined, editorial, lifestyle photography (NOT product packshots unless premium-launch). Example: 'A young woman in her thirties seated on warm sand at golden hour, white linen dress, looking pensively toward the sea. Soft warm light, shallow depth of field, muted ochre and ivory palette.'>",
  "subject": "<60 chars, no emojis, sentence case>",
  "preheader": "<90-120 chars, complements subject>",
  "mjml": "<full valid <mjml> document following the chosen pattern's visual language>"
}`;
}

function buildUserPrompt(input: TemplateGenInput, productContext: string): string {
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
${productContext}
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

  // Pull a sample of real products so the LLM can reference actual SKUs, prices
  // and image URLs instead of fabricating placeholders.
  const products = await loadProductHints(input.storeSlug, input.pillar);
  const productContext = buildProductContextBlock(products);

  // For DESIGN, prefer GPT-4o (better aesthetic + structure) over DeepSeek.
  // DeepSeek is great for translation but produces more templatey output here.
  // Order: gpt-4o > deepseek > gpt-4o-mini (fallback when neither exists).
  const openai   = await getCredential("TRANSLATION_OPENAI");
  const deepseek = await getCredential("TRANSLATION_DEEPSEEK");
  const cred = openai ?? deepseek;
  if (!cred) throw new Error("No LLM provider configured. Pega OpenAI o DeepSeek key en Settings → Integrations.");

  const useOpenai = !!openai;
  const url   = useOpenai ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
  const model = useOpenai
    ? (cred.meta?.designModel as string) ?? (cred.meta?.model as string) ?? "gpt-4o"
    : (cred.meta?.model as string) ?? "deepseek-chat";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(palette) },
        { role: "user", content: buildUserPrompt(input, productContext) },
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
  let parsed: { subject?: string; preheader?: string; mjml?: string; layoutPattern?: string; bannerPrompt?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}...`);
  }
  if (!parsed.subject || !parsed.preheader || !parsed.mjml) {
    throw new Error("LLM response missing subject/preheader/mjml");
  }
  if (!parsed.mjml.includes("<mjml>")) {
    throw new Error("LLM mjml output doesn't look like MJML (no <mjml> root)");
  }

  // Banner generation step: if the LLM gave us a bannerPrompt and Gemini is
  // configured, run image gen now and inject the real URL into the MJML in
  // place of the cdn.divain.space placeholder.
  let finalMjml = parsed.mjml;
  let bannerAssetId: string | undefined;
  let bannerUrl: string | undefined;
  const shouldGenBanner = input.generateBanner !== false && !!parsed.bannerPrompt;
  if (shouldGenBanner) {
    try {
      const gemini = await getCredential("IMAGE_GEMINI");
      if (gemini) {
        const img = await generateBanner({
          prompt: parsed.bannerPrompt!,
          aspectRatio: "3:2",
          brandHints: {
            palette: [palette.primary, palette.bg, palette.text].filter(Boolean),
            style: "editorial lifestyle photography for divain perfume brand",
            avoidText: true,
          },
        });
        const bytes = Buffer.from(img.base64, "base64");
        const asset = await prisma.asset.create({
          data: {
            name: `hero-${parsed.layoutPattern ?? "auto"}-${Date.now()}`,
            kind: "IMAGE",
            mimeType: img.mimeType,
            data: bytes,
            sizeBytes: bytes.length,
            tags: ["ai-generated", "hero", input.storeSlug ?? "global"],
            prompt: parsed.bannerPrompt,
            generatedBy: "gemini-2.5-flash-image",
          },
          select: { id: true },
        });
        bannerAssetId = asset.id;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
        bannerUrl = `${appUrl}/api/assets/${asset.id}`;
        // Substitute any cdn.divain.space/banners/... placeholder with the real URL.
        finalMjml = finalMjml.replace(
          /https:\/\/cdn\.divain\.space\/banners\/[^"'\s)]+/g,
          bannerUrl,
        );
      }
    } catch (e) {
      // Banner gen failure must not block template creation — log and continue
      // with the placeholder URL. User can regenerate later.
      console.warn("[generate-template] banner gen failed, falling back to placeholder:", e instanceof Error ? e.message : e);
    }
  }

  return {
    subject: parsed.subject,
    preheader: parsed.preheader,
    mjml: finalMjml,
    layoutPattern: parsed.layoutPattern,
    bannerPrompt: parsed.bannerPrompt,
    bannerAssetId,
    bannerUrl,
    modelUsed: model,
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}
