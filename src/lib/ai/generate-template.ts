// AI template generator (skeleton-based architecture).
//
// The LLM is NO LONGER responsible for emitting MJML. It picks a layout
// pattern and writes copy (subject, preheader, headline, etc.) + a banner
// prompt for Gemini. The server then renders one of the 8 hand-crafted MJML
// skeletons in template-skeletons.ts with the LLM's copy + the Gemini-
// generated hero URL.
//
// Why: even good LLMs produce templatey MJML, and cheap ones produce sub-par
// designs. The skeleton library gives us professional visual output regardless
// of which model writes the copy — and translation downstream only has to
// fan-out the slots, not re-parse MJML structure.

import type { Prisma } from "@prisma/client";
import { getCredential } from "../credentials";
import { prisma } from "../db";
import { generateBannerAny } from "../banner-provider";
import { LAYOUT_LIBRARY } from "./template-patterns";
import { renderSkeleton, type SkeletonSlots } from "./template-skeletons";

export type TemplateGenInput = {
  brief: string;
  pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL";
  storeSlug?: string;
  language?: string;
  tone?: string;
  generateBanner?: boolean;
  imageQuality?: "low" | "medium" | "high";    // previews use low to keep within Hobby 60s
  imageModelOverride?: string;                  // e.g. force gpt-image-1 to avoid the -2 fallback dance
  skipProductReferences?: boolean;              // previews skip the /edits path for ~3x speed
};

type StorePalette = { primary?: string; accent?: string; bg?: string; text?: string };
// Locked Divain editorial palette — pure monochrome. User asked to remove the
// gold accent entirely after seeing it leak into hero blocks. The /settings/
// brand page isn't writing to DB yet, so the generator pins these values and
// ignores store.brandPalette.
const DEFAULT_PALETTE: Required<StorePalette> = {
  primary: "#0E0E0E", // brand black — section bgs, CTAs, headlines
  accent:  "#0E0E0E", // intentionally black — gold is BANNED until further notice
  bg:      "#FBF8F3", // warm cream — body background
  text:    "#1A1A1A", // type
};

export type TemplateGenOutput = {
  subject: string;
  preheader: string;
  mjml: string;
  layoutPattern: string;
  bannerPrompt?: string;
  bannerAssetId?: string;
  bannerUrl?: string;
  bannerError?: string;
  modelUsed: string;
  promptTokens?: number;
  completionTokens?: number;
};

type ProductHint = {
  handle: string;
  title: string;
  imageUrl: string | null;
  price: string | null;
  productUrl: string | null;
};

async function loadProductHints(storeSlug: string | undefined, pillar: string | undefined): Promise<ProductHint[]> {
  if (!storeSlug) return [];
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, countryCode: true, currency: true, storefrontUrl: true, productExcludedSkuPatterns: true },
  });
  if (!store) return [];

  // Pillar keyword sets — divain's productType + tags are written in Spanish
  // business terms (e.g. "PACK DE MUESTRAS", "PERFUMES MUJER"), not the
  // schema's enum names. Match loosely.
  const PILLAR_KEYWORDS: Record<string, string[]> = {
    PARFUMS: ["perfume", "fragancia", "parfum", "eau de", "edt", "edp"],
    CARE:    ["care", "skincare", "crema", "vitamina", "facial", "ritual de piel", "body", "cuerpo"],
    HOME:    ["home", "casa", "vela", "candle", "difusor", "diffuser", "hogar"],
    RITUAL:  ["ritual", "set", "edicion limitada", "edición limitada", "premium"],
  };

  // Strategy: prefer products WITH an image AND matching the pillar, then with
  // an image (regardless of pillar), then anything active.
  //
  // Exclusion patterns are now per-store (Store.productExcludedSkuPatterns,
  // editable from Settings → Stores). Env var SENDIFY_AI_EXCLUDED_SKU_PATTERNS
  // is honoured as a global fallback for stores that haven't configured their
  // own list yet, and DEFAULT_EXCLUDED_PATTERNS as last-resort.
  const DEFAULT_EXCLUDED_PATTERNS = ["BOLSA", "GOMINOLAS", "MUESTRA", "SAMPLE"];
  const storeLevel = store.productExcludedSkuPatterns ?? [];
  const envExcluded = (process.env.SENDIFY_AI_EXCLUDED_SKU_PATTERNS ?? process.env.SENDIFY_AI_EXCLUDED_SKUS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const excludedPatterns = storeLevel.length > 0 ? storeLevel
                         : envExcluded.length  > 0 ? envExcluded
                         : DEFAULT_EXCLUDED_PATTERNS;

  const keywords = pillar && pillar !== "ALL" ? (PILLAR_KEYWORDS[pillar] ?? []) : [];

  // Exclude products where any variant SKU matches any pattern (case-insensitive
  // substring match). Also belt-and-suspenders on gift cards via productType /
  // handle since those tend to have empty SKUs that patterns can't catch.
  const skuExclusionNot: Prisma.ProductWhereInput[] = excludedPatterns.length > 0
    ? [{
        variants: {
          some: {
            OR: excludedPatterns.map((p) => ({
              sku: { contains: p, mode: "insensitive" as const },
            })),
          },
        },
      }]
    : [];

  const baseWhere: Prisma.ProductWhereInput = {
    storeId: store.id,
    status: "active",
    NOT: [
      ...skuExclusionNot,
      { productType: { contains: "gift", mode: "insensitive" } },
      { handle: { contains: "gift-card", mode: "insensitive" } },
    ],
  };

  // Tier 1: pillar match + has image
  let products = keywords.length > 0
    ? await prisma.product.findMany({
        where: {
          ...baseWhere,
          imageUrl: { not: null },
          OR: keywords.flatMap((k) => [
            { title: { contains: k, mode: "insensitive" as const } },
            { productType: { contains: k, mode: "insensitive" as const } },
            { tags: { hasSome: [k, k.toLowerCase(), k.toUpperCase()] } },
          ]),
        },
        orderBy: { shopifyUpdatedAt: "desc" },
        take: 8,
        select: { handle: true, title: true, imageUrl: true, variants: { take: 1, select: { prices: { where: { market: store.countryCode }, take: 1, select: { price: true } } } } },
      }).catch(() => [])
    : [];

  // Tier 2: any active product WITH image
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: { ...baseWhere, imageUrl: { not: null } },
      orderBy: { shopifyUpdatedAt: "desc" },
      take: 8,
      select: { handle: true, title: true, imageUrl: true, variants: { take: 1, select: { prices: { where: { market: store.countryCode }, take: 1, select: { price: true } } } } },
    }).catch(() => []);
  }

  // Tier 3: anything active (no image guarantee)
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: baseWhere,
      orderBy: { shopifyUpdatedAt: "desc" },
      take: 8,
      select: { handle: true, title: true, imageUrl: true, variants: { take: 1, select: { prices: { where: { market: store.countryCode }, take: 1, select: { price: true } } } } },
    }).catch(() => []);
  }

  const storefront = (store.storefrontUrl ?? "").replace(/\/$/, "");
  return products.map((p) => ({
    handle: p.handle,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.variants[0]?.prices[0]?.price?.toString() ?? null,
    productUrl: storefront ? `${storefront}/products/${p.handle}?utm_source=sendify&utm_medium=email` : null,
  }));
}

function buildSystemPrompt(): string {
  const patternList = LAYOUT_LIBRARY.map((p) => `- ${p.id}: ${p.whenToUse}`).join("\n");
  return `You are the senior brand copywriter for divain®, a perfume house from Alicante.
You will choose ONE layout pattern that fits the brief and fill its copy slots. You do NOT write HTML or MJML — the server renders a hand-crafted skeleton with your slot values.

PATTERN CHOICES (pick exactly one):
${patternList}

OUTPUT — pure JSON, no markdown fences, no commentary:
{
  "layoutPattern": "<one of the ids above>",
  "subject": "<≤60 chars · sentence case · no emojis · in the brief's language>",
  "preheader": "<90–120 chars · complements but does not repeat the subject>",
  "headline": "<the hero copy, the biggest line in the email. For big-number-hero, this is JUST the offer number (e.g. '55%' or '11,99€'). For lifestyle-hero, this is the editorial subject line ('Para ellas, lo que merecen'). For premium-launch, the product name. Keep it short — under 8 words.>",
  "subhead": "<optional · supporting line under the headline · uppercase letter-spaced label · ≤30 chars · for big-number-hero this is 'DE DESCUENTO' / 'TODOS LOS PERFUMES A' / etc.>",
  "body": "<optional · 35-70 word editorial paragraph for the body of the email. Cálido, refinado, castellano de España neutral. No emojis. No 'click here'.>",
  "offerNumber": "<used only when layoutPattern is big-number-hero. The bare number/price/percent: '55%', '12,99€', '−30%'.>",
  "offerLabel": "<used only when layoutPattern is big-number-hero. 5-30 char uppercase label like 'DE DESCUENTO', 'TODOS LOS PERFUMES A', 'SOLO HOY'.>",
  "ctaLabel": "<the primary button label · UPPERCASE · 2-3 words · 'DESCUBRIR', 'COMPRAR', 'VER COLECCIÓN', 'DESCARGAR APP'. NEVER 'CLICK HERE' or 'AQUÍ'.>",
  "productName": "<used only when premium-launch. Real product name from the catalog if available, otherwise invent a believable one tied to the brief>",
  "productCopy": "<used only when premium-launch. 4-8 word label below the product name — 'Edición limitada · 200 unidades', 'Disponible desde 12 mayo'>",
  "customerIncentive": "<used only when winback-empathic. The incentive as displayed: '-15%', 'envío gratis'>",
  "bannerPrompt": "<REQUIRED for every layout except countdown-urgency. Describe an editorial fashion scene featuring a REAL-LOOKING WOMAN MODEL — NO products in the photo, no bottles, no boxes, no labels. The actual divain product is displayed SEPARATELY in the email (in the 'Selección destacada' section), not in this photo. Treat this prompt like a magazine cover shoot of a model.\\n\\nDivain's aesthetic is editorial fashion photography: woman on a beach, in a forest, on sand dunes, by the sea, in a garden. Dressed naturally (linen, swimsuit, sundress, knitwear) depending on the brief's season.\\n\\n50-80 words. Describe: the woman, her wardrobe, the setting, the mood, the light, the colour palette. ZERO text/logos/captions/numbers/products in the image.\\n\\nGood examples:\\n - 'A woman in her late twenties in a white linen sundress on warm sand at golden hour, looking out to sea, eyes half-closed. Soft warm light, shallow depth of field, sandy and ivory palette.'\\n - 'A woman in her thirties walking through a pine forest in a knit cardigan, pausing to look up. Autumn light through trees, warm browns and forest greens, magazine fashion editorial.'\\n - 'A young woman reclining on white dunes at sunset. Peaceful expression, hair pulled back, soft pastel sky, refined and aspirational.'>",
  "spotlight": {
    "title": "<one real product name from the catalog above — exact spelling>",
    "notes": "<5-8 words describing the scent in caps · 'NOTAS DE JAZMÍN, VAINILLA, ÁMBAR'>",
    "story": "<2-3 sentences · 40-60 words · why this product is worth their attention this week. Editorial voice. No exclamation marks. No 'click here'.>",
    "ctaLabel": "<'DESCUBRIRLO' or 'COMPRAR' — 1-2 words uppercase>"
  },
  "editorialBlock": {
    "eyebrow": "<short uppercase label · 'LA HISTORIA', 'NUESTRO RITUAL', 'POR QUÉ DIVAIN' — 1-3 words>",
    "headline": "<8-12 words · serif tone · the angle of the story. 'El perfume como recordatorio diario'.>",
    "paragraphs": [
      "<paragraph 1 · 25-45 words · sets the scene>",
      "<paragraph 2 · 25-45 words · pivots to brand/ritual>"
    ]
  },
  "brandPromise": {
    "eyebrow": "<optional · 'Nuestra promesa' / 'Lo que prometemos' — 1-3 words>",
    "body": "<1-2 SHORT sentences · brand-voice positioning statement · NEVER a customer testimonial · NO fake names · NO quote marks · max 18 words. Examples: 'El mismo acorde, sin la marca encima.' / 'Hechos en Alicante. Pensados para durar.' / 'Calidad de niche, precio honesto.'>",
    "caption": "<optional · 3-6 words · small caption under the promise, e.g. 'Desde 2007 · Alicante' OR omit>"
  },
  "reasons": [
    { "title": "<3-4 word reason title>", "copy": "<1 sentence · 12-18 words · explains the reason>" },
    { "title": "<…>", "copy": "<…>" },
    { "title": "<…>", "copy": "<…>" }
  ],
  "fragranceNotes": {
    "_HINT": "ONLY include this object when layoutPattern is 'premium-launch'. Extract notes from the spotlight product description if mentioned, otherwise OMIT this entire field (do NOT invent notes that aren't in the catalog).",
    "top":   ["<note 1>", "<note 2>"],
    "heart": ["<note 1>", "<note 2>"],
    "base":  ["<note 1>", "<note 2>"]
  },
  "processBlock": {
    "_HINT": "ONLY include this object when layoutPattern is 'premium-launch'.",
    "eyebrow": "<optional · 'Detrás de la fragancia' / 'Cómo se hace' · 1-4 words>",
    "headline": "<8-12 words · editorial story angle for the process behind the product>",
    "paragraphs": [
      "<paragraph 1 · 25-40 words · how this came to be>",
      "<paragraph 2 · 25-40 words · what makes it different>"
    ]
  },
  "founderNote": {
    "_HINT": "ONLY include this object when layoutPattern is 'winback-empathic'.",
    "eyebrow": "<optional · 'Una nota del equipo' / 'Personal' · 1-4 words>",
    "headline": "<5-9 words · warm, sincere, NOT salesy>",
    "body": "<1-2 sentences · 25-40 words · personal, warm, acknowledges absence without guilt-tripping>"
  },
  "appBenefits": [
    { "title": "<2-4 word benefit name>", "copy": "<1 short sentence · 10-15 words>" },
    { "title": "<…>", "copy": "<…>" },
    { "title": "<…>", "copy": "<…>" }
  ],
  "urgencyReasons": [
    { "title": "<2-4 word reason>", "copy": "<1 sentence · 10-15 words>" },
    { "title": "<…>", "copy": "<…>" },
    { "title": "<…>", "copy": "<…>" }
  ],
  "promoCode": {
    "_HINT": "ONLY include when the brief explicitly mentions a discount code or you are 100% certain the campaign needs one. Otherwise OMIT this field — we do NOT invent promo codes that don't exist at checkout.",
    "code": "<the actual code · uppercase · no spaces · 4-15 chars>",
    "label": "<optional · 'Código en el checkout' / 'Aplica al pagar'>"
  },
  "topPromoStrip": {
    "_HINT": "Thin coloured band at the very top of the email. ONLY include when the brief explicitly mentions a sitewide offer or promo. Example: 'Todos los perfumes al 50%'.",
    "text": "<single short line · max 60 chars · the headline offer>"
  },
  "splitNarrative": [
    {
      "_HINT": "Two or three alternating image+text sections that tell the product story. Each section: short ALL-CAPS tagline (2 lines), 1-2 sentence body, CTA. ONLY include for premium-launch when telling a single product's narrative.",
      "tagline": "<2 lines of ALL CAPS tagline separated by \\n · 4-7 words total · e.g. 'NO HUELE A POSTRE.\\nTIENE CARÁCTER.'>",
      "body": "<1-2 sentences · 20-35 words · concrete, sensorial, in lowercase>",
      "ctaLabel": "<2-3 words UPPERCASE · 'QUIERO OLER ASÍ', 'DESCUBRIR', 'COMPRAR AHORA'>"
    }
  ],
  "collectionCallout": {
    "_HINT": "ONLY include for premium-launch when the product belongs to a specific collection you want to highlight. Ties one product to the broader line.",
    "bridgeText": "<1-2 lines · sets up the collection · 'divain.1087 no está sola. Forma parte de nuestra colección más intensa.'>",
    "bodyText": "<1 sentence · names other SKUs from the catalog that share the theme · 25-40 words>",
    "italicCloser": "<optional · 1-2 lines of poetic italic closer · 'Porque hay perfumes que te acompañan. Y hay perfumes que definen.'>",
    "ctaLabel": "<UPPERCASE · 'EXPLORA LA COLECCIÓN'>"
  }
}

ADDITIONAL HINTS FOR PRODUCT-NARRATIVE FLOWS (premium-launch):
- splitNarrative is the heart of premium-launch. Aim for 2 sections that tell the perfume's story: top notes → heart → base. Each tagline must be PUNCHY, 2 lines of caps separated by \\n. The body sensorialises the notes.
- collectionCallout ties this drop to the broader collection. Only include when the brief mentions a collection.
- topPromoStrip appears literally only when there's a sitewide offer.

DO NOT include topPromoStrip / splitNarrative / collectionCallout for non-premium-launch patterns.

CRITICAL RULES FOR THE NEW BLOCKS:
- NEVER invent customer testimonials, names, or quotes. The brandPromise is BRAND voice, not a fake review.
- NEVER invent product fragrance notes unless they're literally in the catalog product description above.
- NEVER invent a promo code unless the brief gives you one — leave promoCode out otherwise.
- For winback-empathic ALWAYS include founderNote. For premium-launch ALWAYS include processBlock and (when possible) fragranceNotes. For brand-anthology ALWAYS include reasons (3 items) and brandPromise. For app-promo-gradient ALWAYS include appBenefits (3 items). For countdown-urgency ALWAYS include urgencyReasons (3 items). For lifestyle-hero include brandPromise. For big-number-hero include brandPromise + promoCode if you have one.

DECISION HEURISTIC:
- Brief mentions hard sell + big % → big-number-hero
- Mother's Day / Father's Day / brand-storytelling → lifestyle-hero
- Gift guides / 'top 5' / curations → product-grid-editorial
- App promo / push beneficios → app-promo-gradient
- Welcome / discover divain → brand-anthology
- 24h / 'ends tonight' / urgency → countdown-urgency
- New SKU launch (RITUAL etc) without discount → premium-launch
- Inactive 60-120 days → winback-empathic`;
}

function buildUserPrompt(input: TemplateGenInput, products: ProductHint[]): string {
  const pillarHint = input.pillar === "ALL"
    ? "Audience: general divain customers."
    : `Pillar: divain. ${input.pillar} (focus the email on this line).`;
  const toneHint = `Tone: ${input.tone ?? "editorial-cálido"}.`;
  const langHint = `Source language: ${input.language ?? "es-ES"} (downstream translation fans out to 22 languages).`;
  const catalogBlock = products.length === 0
    ? "REAL CATALOG: (store not yet synced — write copy without naming specific SKUs)"
    : `REAL CATALOG SAMPLE (THESE ARE THE ONLY PRODUCT NAMES YOU MAY USE — do not invent product names, do not mention essential oils, creams or anything not in this list):\n${products.map((p, i) => `${i + 1}. ${p.title}${p.price ? ` · ${p.price}` : ""}`).join("\n")}`;

  return `BRIEF:
"""
${input.brief}
"""
${pillarHint}
${toneHint}
${langHint}

${catalogBlock}

STRICT RULES:
- If the body mentions any product, it MUST be exactly one from the catalog above.
- Do NOT invent or hallucinate product names. If unsure, keep the body generic (e.g. "tu fragancia favorita") rather than naming a product that isn't in the catalog.
- Do NOT mention "aceite esencial", "crema", "vitamina" or any other product type that isn't visible in the catalog list.

Return the JSON object now.`;
}

// ── Hero prompt builder ─────────────────────────────────────────────────────
//
// Pattern-aware override of the LLM's bannerPrompt. We don't trust the LLM
// to produce a coherent hero brief on its own — different email layouts need
// very different photography. This function takes the layout pattern + the
// LLM's prompt and emits a strict image-gen instruction the model can follow.
//
// Universal rule (every pattern): NO bottles, NO products, NO packaging, NO
// boxes, NO labels, NO brand text, NO numbers, NO captions. The bottle is
// shown separately in the email's product grid section using real Shopify
// CDN URLs — not in this AI photo. We learned the hard way that gpt-image-2
// invents bottle shapes regardless of references, so we just don't include
// them in the hero at all.

// Universal rule for every hero: zero text, zero numbers, zero captions, zero
// logos. The bottle has Divain's branding on its label — that's allowed (it
// comes from the reference image and the model preserves it as-is). What's
// forbidden is fabricated text in the scene: signage, captions, overlays.
const NO_TEXT_RULE = "The image MUST NOT contain any captions, overlay text, signage, hashtags, written prices, percentages, numbers, dates, or fabricated brand names anywhere in the scene. Any text on the actual product bottle (from the reference) is fine and must be preserved exactly as shown.";

// When a real product photo is provided as a reference, the prompt instructs
// the model (Gemini Nano Banana / gpt-image-2 edits) to compose the scene
// AROUND that exact bottle — preserve its shape, label, glass color, cap. Per
// user explicit ask: the real Divain bottle must appear in the hero AND its
// "DIVAIN-XXX" label text must remain readable. Without the label the bottle
// just reads as "generic perfume", which defeats the purpose of using a ref.
const KEEP_PRODUCT_RULE = "The perfume bottle from the attached reference image MUST appear in this scene as a HERO element — sized prominently so it is the visual anchor of the photograph, NOT a small prop in the corner. Preserve the bottle EXACTLY: same glass shape, same color, same cap, AND the printed label artwork including the 'divain.' wordmark and SKU number must be clearly legible. Do NOT redesign, restyle, recolor, blur, obscure or reinterpret the bottle or its label. Place the bottle close to camera so the label text is readable in the final image.";

// Era / styling guardrail. The model loves to drift into 19th-century vibes
// (candlelit letter-writing, wax-sealed envelopes, oil lamps) whenever the
// prompt mentions "intimate" or "warm light". This rule pins everything to
// present-day fashion editorial — exactly the brand reference (divainparfums
// Klaviyo emails are 2020s minimalist, not Victorian).
const MODERN_ERA_RULE = "Contemporary 2020s setting and styling — modern minimalist fashion editorial. NO candles as a light source, NO oil lamps, NO wax-sealed envelopes, NO fountain pens, NO Victorian or vintage period costume, NO sepia tones, NO 19th-century furniture. Modern wardrobe, modern interior design, modern hair and makeup.";

// Exported so the asset-pool refill cron can call into the same prompt
// library (pattern-aware briefs that produce Higgsfield-quality output).
export function buildHeroPromptForLayout(layoutPattern: string, llmPrompt: string, hasProductRef: boolean, brief?: string): string {
  return buildHeroPrompt(layoutPattern, llmPrompt, hasProductRef, brief);
}

// Patterns that NEED an AI-generated scene photo (model in environment) to
// work visually. Everything else is designed to lead with typography + the
// real Shopify product photo, which:
//   • is always correct (no hallucinated bottle, no wrong era, no wrong season)
//   • doesn't fail when image generation quota runs out
//   • takes 0ms vs 8-15s per generation
//
// This was the fix for "como pretendes que esos diseños estan asi listos para
// enviar" — most templates were hostage to whether the AI hero came out OK.
// Now only lifestyle-hero (model + scene is the entire point), big-number-hero
// (the big number lays over a photo for drama) and app-promo-gradient (phone
// scene with hands) generate AI heroes. The rest are product-photo + type.
export const AI_HERO_PATTERNS = new Set<string>([
  "lifestyle-hero",
  "big-number-hero",
  "app-promo-gradient",
]);

// Pool of composition variants used to break the "aspirational woman holding
// the bottle in front of her" monotony. Each call picks one randomly so
// consecutive emails feel different even with the same layout.
const LIFESTYLE_COMPOSITIONS = [
  "a real woman in her late 20s on a warm-toned sandy beach at golden hour, the bottle held prominently in her hand near her shoulder",
  "a real woman in a contemporary knit cardigan inside a sun-lit modern Mediterranean apartment, the bottle on a marble side table in the foreground, her hand reaching for it",
  "a real woman in a linen sundress walking through a wildflower field, the bottle held close to camera in her foreground hand",
  "a real woman seated on a modern concrete garden bench at dusk, the bottle prominently on the seat beside her hand, soft pastel light",
  "a real woman in a silk robe on a modern terrace with a sea view, the bottle on a small white table in the foreground, morning light",
  "a real woman in a sleek wool coat in a park clearing in autumn, the bottle held close to camera in her gloved hand, soft golden leaf light",
  "a real woman in front of an open window with sheer linen curtains in a modern apartment, the bottle on the windowsill prominently in the foreground, soft white light",
  "a real woman on a modern rooftop terrace in summer, the bottle on a small side table in the foreground, city light haze behind",
];

const STILL_LIFE_COMPOSITIONS = [
  "warm-toned marble slab, single white peony beside the bottle, soft side light",
  "creased linen draped on a dark walnut surface, the bottle centred, golden afternoon sun",
  "raw silk in champagne tones, the bottle leaning slightly, candle in foreground out of focus",
  "wet pebble beach surface, bottle catching sea reflection, overcast moody light",
  "pressed dried botanicals scattered around the bottle on cream paper, overhead flat lay",
  "weathered terracotta tile with single sprig of lavender, bottle in afternoon shade",
  "polished obsidian surface, single drop of perfume on it, the bottle reflected, low key dramatic light",
  "rough natural linen tablecloth with crumbs of dark chocolate, the bottle and a small glass of espresso",
];

// Close-crop / detail compositions — bottle dominant, human element is just a
// hand, sleeve, strand of hair. Used for premium launches.
const CLOSE_CROP_COMPOSITIONS = [
  "a manicured hand emerging from a cream silk sleeve, holding the bottle near a sunlit window",
  "the bottle resting on a polished walnut dresser, a hand reaching from frame-left to lift it",
  "the bottle balanced between two slender fingers above a dark velvet surface, dramatic side light",
  "the bottle on the curved palm of an open hand, soft directional north light, fingertips out of focus",
  "the bottle held against a bare collarbone, soft golden skin, neckline of a champagne silk dress",
  "the bottle photographed at eye level on a marble countertop, a wrist with a thin gold bracelet entering frame",
  "the bottle nestled in folded ivory linen sheets, a hand lifting one corner of the fabric",
  "the bottle on a tray with a lit candle, a hand setting it down, motion blur in the wrist only",
];

// Cinematic / mood compositions for countdown / urgency layouts. Slight tension.
const URGENCY_COMPOSITIONS = [
  "the bottle on a marble bathroom counter under a single overhead spot, modern brass faucet behind, deep shadows",
  "the bottle in a hand mid-motion reaching across a dark concrete table, ambient pendant light",
  "the bottle on a sleek nightstand beside an unmade bed at golden hour, low sun cutting through linen curtains",
  "the bottle on a brass tray with a folded note and a modern matte-black pen, late-night warm lamp glow",
  "the bottle on a bathroom vanity with steam softening a back-lit mirror, a robe on a chrome hook in the background",
  "the bottle on a windowsill at last light, city skyline blurred in the distance, single modern pendant lamp inside",
  "the bottle on a velvet bench in a darkened dressing room, single overhead light beam, theatrical contemporary mood",
  "the bottle on a glass coffee table next to a folded copy of a fashion magazine, low evening light through floor-to-ceiling windows",
];

// App promo compositions — phone + bottle, modern lifestyle. Soft daylight.
const APP_COMPOSITIONS = [
  "a hand holding a smartphone with a blank dark screen, the bottle just behind it on a marble countertop, soft window light",
  "the bottle and a smartphone face-down side by side on a pale linen tablecloth, espresso cup half in frame",
  "a phone resting against the bottle on a sun-lit terrace table, summer haze, the screen reflecting the sky",
  "the bottle on a bedside table with a phone face-up beside it (screen dark), morning light through sheer curtains",
  "a phone propped on a small notebook next to the bottle on a wooden desk, single desk lamp lit",
  "a hand sliding a phone into a leather bag, the bottle visible on a hallway console table behind, daylight",
  "the bottle and phone on the corner of a wide kitchen island, fresh peonies in a vase out of focus, north light",
  "a phone resting on an open glossy magazine, the bottle beside it on a velvet ottoman, soft afternoon light",
];

// Environmental wide shots for product grids — model present in a refined
// setting with the bottle visible on a surface in the scene.
const ENVIRONMENT_COMPOSITIONS = [
  "a real woman in an ivory silk slip dress at a sun-lit vanity, the bottle visible on the vanity surface beside her, magazine campaign feel",
  "a real woman at a marble kitchen island arranging fresh flowers, the bottle on the island near a glass of water",
  "a real woman seated by an open terrace door reading a paperback, the bottle on the small side table beside her chair",
  "a real woman in a linen kaftan on a Mediterranean veranda, the bottle resting on a tiled garden wall beside a small lamp",
  "a real woman pulling sheer curtains aside at a bedroom window, the bottle on the windowsill catching the light",
  "a real woman at a dressing table in a soft robe, the bottle among small ceramic dishes and a single ring",
  "a real woman walking through a wide hallway in a country house, the bottle just behind her on a console table",
  "a real woman seated on a low daybed beside an open garden door, the bottle on the floor on a small tray of pebbles",
];

// Cinematic interior portraits — quiet contemplative mood. Brand anthology.
const INTERIOR_COMPOSITIONS = [
  "a real woman at a floor-to-ceiling window in soft morning light, the bottle on the inner sill beside her, looking out, modern minimalist apartment",
  "a real woman reclining on a low cream linen sofa in a contemporary living room, the bottle on a sculptural side table beside her",
  "a real woman at a modern lacquer vanity tying her hair up, the bottle reflected in the round mirror in front of her",
  "a real woman in a sleek kitchen at golden hour, hands resting on a concrete island, the bottle and a single fresh fig beside her",
  "a real woman seated on a modern teak chair on a minimalist terrace, the bottle on the table beside a glass of water",
  "a real woman at a streamlined writing desk in a contemporary loft, the bottle and a closed notebook beside her hand, daylight",
  "a real woman silhouetted in a doorway with sun behind her, the bottle on a polished concrete threshold inside the room",
  "a real woman lying on her side on white sheets at dawn, the bottle on a modern bedside table, soft cool morning light",
];

// Empathic / winback — intimate, quiet, low-key. The bottle is nearby, never
// the centre of attention. Models in vulnerable, contemplative postures.
const EMPATHIC_COMPOSITIONS = [
  "a real woman sitting cross-legged on a wooden floor by a window, the bottle on the floor beside her, soft afternoon light",
  "a real woman in an oversized cardigan holding a steaming mug, the bottle on the kitchen counter behind her, slightly out of focus",
  "a real woman lying on her back on rumpled linen sheets, the bottle on the bedside table just inside frame, warm golden hour",
  "a real woman at a bathroom sink with hair pulled back, the bottle on the marble counter in front of the mirror, north window light",
  "a real woman seated on a stairwell landing reading a letter, the bottle on the step beside her, single overhead lamp",
  "a real woman wrapped in a long beige scarf on a balcony at dusk, the bottle on the iron table with an empty teacup",
  "a real woman crouched packing a small linen bag on the floor of a sunlit bedroom, the bottle on the floor by her knee",
  "a real woman seated on a velvet armchair in lamplight, the bottle on the side table beside her hand, no eye contact",
];

// Deterministic per-call pick (uses crypto random) so two consecutive emails
// for the same layout don't get the same composition.
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Seasonal / occasion context detection ────────────────────────────────
//
// The composition pools above are tuned for general editorial use, so a
// random pick can produce "sun-lit Mediterranean terrace" right when the
// campaign is about Navidad. Without seasonal awareness the model picks the
// more concrete cue (the composition) and ignores the brief's "Christmas"
// signal. We detect the season/occasion from the LLM's banner-prompt seed
// and inject a hard override that the model must respect.
//
// Why we don't just delete the composition pools when seasonal context is
// detected: the compositions add specific camera + lighting + framing rules
// the model otherwise can't infer ("close-crop", "85mm", "shallow DoF"). We
// want both — but the season has to win the styling/wardrobe/props fight.

type SeasonalContext = {
  occasion: string | null;
  styling: string;
};

function detectSeasonalContext(seed: string): SeasonalContext {
  const t = seed.toLowerCase();

  // Order matters — more specific occasions first, fallback seasons last.
  if (/navidad|christmas|xmas|nochebuena|noche\s*buena|no[eë]l|advent/.test(t)) {
    return {
      occasion: "Christmas",
      styling: "WINTER CHRISTMAS SETTING: warm cosy interior with subtle holiday cues — fir branches, eucalyptus, neutral linen ribbon, small white candles (unlit or behind glass), fairy lights softly glowing, evergreen sprigs. Wardrobe MUST be winter: cashmere knitwear, wool coats, silk blouses with long sleeves, faux-fur trim, neutral tones (cream, camel, soft black). Lighting: warm tungsten lamps mixed with cool window light from a snowy or grey outdoor view. ABSOLUTELY NO: bare arms, beach, terrace, sun-bleached light, summer florals, wildflowers, sand, swimsuits, sundresses, exposed skin in daylight, pine forests in summer green.",
    };
  }
  if (/black\s*friday|cyber\s*monday|cybermonday/.test(t)) {
    return {
      occasion: "Black Friday",
      styling: "LATE-AUTUMN EVENING SETTING: moody contemporary urban scene — dark concrete interior, tungsten pools of light, city windows at night with reflections, late-autumn coats. Wardrobe: dark wool coats, knitwear, leather, deep neutrals. ABSOLUTELY NO summer or spring scenes, NO golden-hour beaches, NO sundresses.",
    };
  }
  if (/halloween|all\s*hallows|samhain/.test(t)) {
    return {
      occasion: "Halloween",
      styling: "AUTUMN MOODY SETTING: contemporary atmospheric scene with deep shadow, late-October colour palette of burnt orange / charcoal / blackberry. Modern wardrobe in dark tones, soft theatrical light. NO costumes, NO horror props. NO summer cues.",
    };
  }
  if (/valent|14\s*de\s*febrero|san\s*valent[íi]n|saint\s*valentine/.test(t)) {
    return {
      occasion: "Valentine's Day",
      styling: "LATE-WINTER INTIMATE SETTING: cosy contemporary indoor — silk slip in burgundy or champagne, soft rose petals scattered, modern minimalist warm interior. Soft red, blush, and warm gold accents (subtly — not kitsch). Wardrobe: long sleeves, silk, knitwear. NO summer terrace, NO beach, NO golden-hour outdoor.",
    };
  }
  if (/d[íi]a\s*de\s*la\s*madre|mother'?s\s*day|festa\s*della\s*mamma|f[eê]te\s*des\s*m[eè]res|muttertag/.test(t)) {
    return {
      occasion: "Mother's Day",
      styling: "SPRING SETTING: peonies, magnolia, fresh greenery, soft pastel daylight through sheer linen curtains, modern minimalist home or garden. Wardrobe: light spring knit, silk blouse, soft linen. NO Christmas cues, NO winter coats, NO snow.",
    };
  }
  if (/pascua|easter|p[âa]ques|ostern/.test(t)) {
    return {
      occasion: "Easter",
      styling: "EARLY-SPRING SETTING: garden in fresh bloom, white tulips, almond blossom, soft morning light. Wardrobe: pastel linen, light cardigan. NO heavy winter wear, NO summer beach.",
    };
  }
  if (/d[íi]a\s*del\s*padre|father'?s\s*day|festa\s*del\s*pap[àa]|f[eê]te\s*des\s*p[eè]res/.test(t)) {
    return {
      occasion: "Father's Day",
      styling: "EARLY-SUMMER MASCULINE SETTING: tailored linen, warm dusk light, refined dark wood or stone interior. NO floral spring, NO Christmas cues.",
    };
  }
  if (/rebajas|sales|soldes|saldi|outlet/.test(t) && !/black|cyber|navid|christmas/.test(t)) {
    // Generic sale — let composition lead, no override.
    return { occasion: null, styling: "" };
  }
  // Generic seasons — only used when no occasion matches.
  if (/invierno|winter|enero|febrero|nieve|snow|hiver/.test(t)) {
    return { occasion: "Winter", styling: "WINTER SETTING: cool grey light, cashmere and wool wardrobe, modern cosy interior, NO bare arms or summer cues." };
  }
  if (/primavera|spring|abril|mayo|printemps/.test(t)) {
    return { occasion: "Spring", styling: "SPRING SETTING: fresh blooms, soft daylight, light linen wardrobe, gentle pastel palette. NO Christmas cues, NO snow." };
  }
  if (/verano|summer|julio|agosto|playa|vacaciones\s*de\s*verano|été/.test(t)) {
    return { occasion: "Summer", styling: "SUMMER SETTING: warm golden light, linen sundresses, light fabrics, sandy or terrace setting OK. NO winter coats." };
  }
  if (/oto[ñn]o|autumn|fall|noviembre|octubre|automne/.test(t)) {
    return { occasion: "Autumn", styling: "AUTUMN SETTING: warm amber light, knitwear and wool, late-October colour palette. NO summer terrace, NO snow." };
  }
  return { occasion: null, styling: "" };
}

function withSeasonalOverride(prompt: string, seed: string, brief?: string): string {
  // Check BOTH the LLM-generated banner prompt AND the original brief. The
  // LLM may strip seasonal keywords ("regalos de navidad únicos" → "luxury
  // perfume gift photograph") leaving us blind to the season. Scanning the
  // raw brief catches it regardless.
  const ctx = detectSeasonalContext(`${brief ?? ""}\n${seed}`);
  if (!ctx.styling) return prompt;
  // The override is appended LAST so the model treats it as the dominant
  // instruction (most LLMs/diffusion models weight later instructions more
  // when they conflict with earlier ones).
  return `${prompt} CRITICAL ${ctx.occasion ? `${ctx.occasion.toUpperCase()} ` : ""}SEASONAL OVERRIDE — this rule wins over every other styling cue above, including any default composition: ${ctx.styling}`;
}

function buildHeroPrompt(layoutPattern: string, llmPrompt: string, hasProductRef: boolean, brief?: string): string {
  const seed = (llmPrompt || "").trim();

  // With a real product reference (the user's actual Divain bottle), every
  // pattern places that bottle into a scene matched to the layout's mood.
  if (hasProductRef) {
    let prompt: string;
    switch (layoutPattern) {
      case "lifestyle-hero": {
        const comp = pickRandom(LIFESTYLE_COMPOSITIONS);
        prompt = `Editorial luxury perfume advertising photograph: ${comp}. ${seed}. Magazine-cover quality, 85mm lens, shallow depth of field, refined mood. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "big-number-hero": {
        const comp = pickRandom(STILL_LIFE_COMPOSITIONS);
        prompt = `Minimalist editorial still life: ${comp}. ${seed}. Clean composition with negative space on one side (text will overlay there in the email). Magazine quality. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "premium-launch": {
        const comp = pickRandom(CLOSE_CROP_COMPOSITIONS);
        prompt = `Premium editorial product photograph, close-crop: ${comp}. ${seed}. Magazine campaign aesthetic, directional light, refined and quiet. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "countdown-urgency": {
        const comp = pickRandom(URGENCY_COMPOSITIONS);
        prompt = `Cinematic editorial photograph with subtle tension: ${comp}. ${seed}. Magazine quality, slight anticipation, low-key light. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "app-promo-gradient": {
        const comp = pickRandom(APP_COMPOSITIONS);
        prompt = `Modern lifestyle photograph: ${comp}. ${seed}. Soft natural daylight, minimal aesthetic, phone screen blank/dark. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "product-grid-editorial": {
        const comp = pickRandom(ENVIRONMENT_COMPOSITIONS);
        prompt = `Wide editorial environmental photograph: ${comp}. ${seed}. Magazine quality, soft natural light, refined. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "brand-anthology": {
        const comp = pickRandom(INTERIOR_COMPOSITIONS);
        prompt = `Cinematic contemporary editorial portrait: ${comp}. ${seed}. Magazine quality, refined and minimalist, beautifully lit. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      case "winback-empathic": {
        const comp = pickRandom(EMPATHIC_COMPOSITIONS);
        prompt = `Warm intimate contemporary editorial photograph: ${comp}. ${seed}. Soft natural light, emotional warmth, magazine quality. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
        break;
      }
      default:
        prompt = `Editorial luxury perfume advertising photograph: ${seed}. Real model interacting with the perfume bottle from the reference image. Magazine quality, refined mood. ${MODERN_ERA_RULE} ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
    }
    return withSeasonalOverride(prompt, seed, brief);
  }

  // No product reference available — generate a clean editorial scene without
  // any fabricated bottle (since AI-invented bottles look generic and don't
  // match the brand). Person + setting only.
  let basePrompt: string;
  switch (layoutPattern) {
    case "lifestyle-hero":
      basePrompt = `Editorial fashion photograph in the style of high-end perfume brand advertising. ${seed}. Real woman model, natural skin, candid expression, magazine-cover quality, 85mm lens, shallow depth of field, refined mood. No products in frame. ${NO_TEXT_RULE}`;
      break;
    case "big-number-hero":
      basePrompt = `Minimalist editorial still life: ${seed}. Abstract textural composition with negative space for text overlay. ${NO_TEXT_RULE}`;
      break;
    default:
      basePrompt = `Editorial fashion photograph: ${seed}. Real model, magazine quality, refined mood. ${NO_TEXT_RULE}`;
  }
  return withSeasonalOverride(basePrompt, seed, brief);
}

export async function generateTemplate(input: TemplateGenInput): Promise<TemplateGenOutput> {
  // Resolve store palette + storefront URL → drives skeleton colors and links.
  let palette: Required<StorePalette> = DEFAULT_PALETTE;
  let storefrontUrl = "";
  let storeName = "";
  let legalName: string | null = null;
  let legalAddress: string | null = null;
  let legalCity: string | null = null;
  let legalCountry: string | null = null;
  let privacyUrl: string | null = null;
  let brandLogoUrl: string | null = null;
  let brandLogoDarkUrl: string | null = null;
  // Trust band items pulled from Store config. Defaults to [] so the trust
  // bar simply doesn't render when no store-level policy is configured —
  // we don't ship invented shipping promises.
  let trustItems: Array<{ label: string; sub?: string }> = [];
  // Brand accent colour (e.g. divain yellow #FACD37). Read from
  // Store.brandPalette.accent JSON. Falls back to undefined → skeleton uses
  // primaryColor as accent so the email still looks intentional.
  let accentColorFromStore: string | undefined;
  // Service callout — recurring "Try & Buy"-style box configured at the
  // store level so every email of that store can include it without invention.
  let serviceCalloutFromStore: SkeletonSlots["serviceCallout"] | undefined;
  if (input.storeSlug) {
    const store = await prisma.store.findUnique({
      where: { slug: input.storeSlug },
      select: {
        name: true, brandPalette: true, storefrontUrl: true,
        legalName: true, legalAddress: true, legalCity: true, legalCountry: true,
        privacyUrl: true, brandLogoUrl: true, brandLogoDarkUrl: true,
      },
    }).catch(() => null);
    storefrontUrl = (store?.storefrontUrl ?? "").replace(/\/$/, "");
    storeName = store?.name ?? "";
    legalName    = store?.legalName    ?? null;
    legalAddress = store?.legalAddress ?? null;
    legalCity    = store?.legalCity    ?? null;
    legalCountry = store?.legalCountry ?? null;
    privacyUrl   = store?.privacyUrl   ?? null;
    brandLogoUrl     = store?.brandLogoUrl     ?? null;
    brandLogoDarkUrl = store?.brandLogoDarkUrl ?? null;
    // Palette is INTENTIONALLY pinned to DEFAULT_PALETTE for now. Reading
    // store.brandPalette was producing weird yellow hero blocks because a
    // stale value put primary on gold. We'll re-enable per-store palettes
    // once /settings/brand actually writes and the UI sanity-checks values
    // (primary must be high-contrast against bg, etc).
    palette = { ...DEFAULT_PALETTE };
    // Trust items + brand accent + service callout: read from brandPalette
    // JSON (we piggy-back on the existing Json column to avoid a migration).
    // Expected shape:
    //   {
    //     accent: "#FACD37",
    //     trustItems: [{ label, sub? }, ...],
    //     serviceCallout: { eyebrow?, title, body, ctaLabel, ctaUrl? }
    //   }
    // When a key is missing, the corresponding block simply doesn't render —
    // we intentionally do NOT default to "Envío gratis 30€" or invent a
    // Try&Buy block, because those are store-specific claims.
    const brandKitJson = (store?.brandPalette ?? null) as Record<string, unknown> | null;
    const rawTrust = brandKitJson && Array.isArray(brandKitJson.trustItems) ? brandKitJson.trustItems : [];
    trustItems = (rawTrust as unknown[])
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        label: typeof it.label === "string" ? it.label.slice(0, 40) : "",
        sub:   typeof it.sub   === "string" ? it.sub.slice(0, 50)   : undefined,
      }))
      .filter((it) => it.label.length > 0)
      .slice(0, 3);
    // Accent colour — hex like #FACD37 — used for service callout bg + CTAs.
    if (typeof brandKitJson?.accent === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(brandKitJson.accent)) {
      accentColorFromStore = brandKitJson.accent;
    }
    // Service callout — must have at minimum title, body, ctaLabel to render.
    const sc = brandKitJson?.serviceCallout && typeof brandKitJson.serviceCallout === "object" ? brandKitJson.serviceCallout as Record<string, unknown> : null;
    if (sc && typeof sc.title === "string" && typeof sc.body === "string" && typeof sc.ctaLabel === "string") {
      serviceCalloutFromStore = {
        eyebrow: typeof sc.eyebrow === "string" ? sc.eyebrow.slice(0, 60) : undefined,
        title:   sc.title.slice(0, 80),
        body:    sc.body.slice(0, 360),
        ctaLabel: sc.ctaLabel.toUpperCase().slice(0, 30),
        ctaUrl:   typeof sc.ctaUrl === "string" ? sc.ctaUrl : (storefrontUrl || "#"),
      };
    }
  }

  // Shuffle the catalog hints per call so consecutive generations pick a
  // different featured product. Without this every spotlight + every
  // productImageUrl was products[0] (the most-recently-updated SKU) — every
  // email ended up featuring the same bottle. Fisher-Yates on a copy.
  const rawProducts = await loadProductHints(input.storeSlug, input.pillar);
  const products = [...rawProducts];
  for (let i = products.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [products[i], products[j]] = [products[j], products[i]];
  }

  // Pick LLM: OpenAI (better for copy) > DeepSeek (cheaper fallback).
  const openai   = await getCredential("TRANSLATION_OPENAI");
  const deepseek = await getCredential("TRANSLATION_DEEPSEEK");
  const cred = openai ?? deepseek;
  if (!cred) throw new Error("No LLM configured. Pega OpenAI o DeepSeek key en Settings → Integrations.");

  const useOpenai = !!openai;
  const url   = useOpenai ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
  const model = useOpenai
    ? (cred.meta?.designModel as string) ?? (cred.meta?.model as string) ?? "gpt-4o-mini"
    : (cred.meta?.model as string) ?? "deepseek-chat";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input, products) },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
      // Bumped from 1500 → 2400 because the system prompt now asks the LLM
      // for ~7 additional content blocks (brandPromise, reasons, processBlock,
      // founderNote, appBenefits, urgencyReasons, fragranceNotes) on top of
      // the original copy. Truncating at 1500 was silently cutting half of
      // the new blocks and leaving the email looking empty.
      max_tokens: 2400,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 280)}`);
  }
  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = json.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("LLM returned empty response");

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 220)}...`); }

  const layoutPattern: string = LAYOUT_LIBRARY.find((p) => p.id === parsed.layoutPattern)?.id ?? "lifestyle-hero";
  const subject   = String(parsed.subject ?? "").slice(0, 120);
  const preheader = String(parsed.preheader ?? "").slice(0, 180);
  const headline  = String(parsed.headline ?? subject ?? "").slice(0, 200);
  if (!subject || !preheader || !headline) {
    throw new Error("LLM response missing subject/preheader/headline");
  }

  // Banner step — Gemini generates a real photograph (or we skip cleanly).
  let bannerAssetId: string | undefined;
  let bannerUrl: string | undefined;
  let bannerError: string | undefined;
  const bannerPrompt = typeof parsed.bannerPrompt === "string" ? parsed.bannerPrompt.trim() : "";
  // Only patterns that need a model-in-scene photograph attempt AI generation.
  // Product-led patterns (premium-launch, product-grid-editorial, brand-
  // anthology, winback-empathic, countdown-urgency) skip the AI entirely and
  // lean on the real Shopify product photo + typography. This makes those
  // emails bulletproof — no failed AI generations, no wrong seasons, no
  // hallucinated bottles.
  const patternUsesAiHero = AI_HERO_PATTERNS.has(layoutPattern);
  const shouldGenBanner = patternUsesAiHero && input.generateBanner !== false && bannerPrompt.length > 10;
  if (shouldGenBanner) {
    try {
      // 0) Library-first reuse. Strict matching: the asset MUST be tagged with
      // BOTH the exact layoutPattern AND a version marker. Bumping the marker
      // when we change prompt rules invalidates the old library automatically
      // (no DB migration needed) because hasEvery requires the current tag to
      // be present and old assets don't have it.
      //
      // v10 = product-narrative pattern. Premium-launch redone to follow the
      // divain Klaviyo flagship flow: top promo strip → photo hero → intro →
      // alternating split-narrative (image-left / image-right with CAPS
      // tagline) → collection callout → Try&Buy service callout with brand
      // yellow → trust + brand bar. Lifestyle/big-number also gain the top
      // promo strip + service callout when configured at the store level.
      const PROMPT_VERSION = "v10-product-narrative";
      const libraryTags = [layoutPattern, input.storeSlug ?? "global", PROMPT_VERSION];
      const reusable = await prisma.asset.findFirst({
        where: {
          kind: "IMAGE",
          usedCount: 0,
          tags: { hasEvery: libraryTags },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }).catch(() => null);
      if (reusable) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
        bannerAssetId = reusable.id;
        bannerUrl = `${appUrl}/api/assets/${reusable.id}`;
        await prisma.asset.update({
          where: { id: reusable.id },
          data: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
        }).catch(() => {});
      } else {
      // Pick the real Divain product photo to use as a reference. The first
      // product hint coming from the catalog already matches the email's
      // pillar/store, so it's the right bottle to show. Without a reference
      // we fall back to a model-only scene (no fabricated bottle).
      const productRefUrl = products[0]?.imageUrl?.trim() || undefined;
      // Pass the user's raw brief so the seasonal detector catches "navidad"
      // / "día de la madre" / etc. even when the LLM stripped them from its
      // banner prompt during summarisation.
      const heroOnlyPrompt = buildHeroPrompt(layoutPattern, bannerPrompt, !!productRefUrl, input.brief);

      const img = await generateBannerAny({
        prompt: heroOnlyPrompt,
        aspectRatio: "3:2",
        brandHints: {
          palette: [palette.primary, palette.bg, palette.text].filter(Boolean),
          style: "editorial luxury perfume photography",
          avoidText: true,
        },
        quality: input.imageQuality ?? "medium",
        preferredModel: input.imageModelOverride,
        // Pass the real product photo so Gemini composes the scene AROUND it
        // while preserving the bottle's exact shape, label, glass color, cap.
        referenceImageUrls: productRefUrl ? [productRefUrl] : [],
      });
      const bytes = Buffer.from(img.base64, "base64");
      const asset = await prisma.asset.create({
        data: {
          name: `hero-${layoutPattern}-${Date.now()}`,
          kind: "IMAGE",
          mimeType: img.mimeType,
          data: bytes,
          sizeBytes: bytes.length,
          tags: ["ai-generated", "hero", layoutPattern, input.pillar.toLowerCase(), input.storeSlug ?? "global", PROMPT_VERSION],
          // (PROMPT_VERSION is also part of libraryTags above — the asset
          // pool only reuses when tags.hasEvery includes the current version,
          // so bumping it cleanly invalidates the old library without a DB
          // migration.)
          prompt: bannerPrompt,
          generatedBy: img.provider,
          usedCount: 1,
          lastUsedAt: new Date(),
        },
        select: { id: true },
      });
      bannerAssetId = asset.id;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
      bannerUrl = `${appUrl}/api/assets/${asset.id}`;
      }
    } catch (e) {
      bannerError = e instanceof Error ? e.message.slice(0, 320) : "image gen failed";
      console.warn("[generate-template] banner gen failed:", e);
    }
  }
  // NOTE: we intentionally do NOT emit a bannerError when patternUsesAiHero is
  // false — those 5 patterns are designed to lead with the real Shopify
  // product photo + typography, so the absence of an AI hero is a feature,
  // not a failure. Surfacing it as an error caused user confusion ("Imagen
  // no generada"). Likewise if the LLM didn't return a bannerPrompt for a
  // pattern that does use AI heroes, we now ALSO stay silent — the skeleton's
  // no-photo fallback renders a clean type-led version that looks intentional.

  // Render the chosen skeleton with all the slots.
  const slots: SkeletonSlots = {
    preheader,
    headline,
    subhead: parsed.subhead ? String(parsed.subhead).slice(0, 100) : undefined,
    body: parsed.body ? String(parsed.body).slice(0, 600) : undefined,
    offerNumber: parsed.offerNumber ? String(parsed.offerNumber).slice(0, 30) : undefined,
    offerLabel:  parsed.offerLabel  ? String(parsed.offerLabel).slice(0, 40)  : undefined,
    ctaLabel: String(parsed.ctaLabel ?? "DESCUBRIR").toUpperCase().slice(0, 30),
    // Primary CTA points to the country storefront with UTM tracking. Adds
    // ?utm_source=sendify&utm_medium=email so analytics can attribute clicks.
    ctaUrl: storefrontUrl ? `${storefrontUrl}/?utm_source=sendify&utm_medium=email` : "#",
    productName: parsed.productName ? String(parsed.productName).slice(0, 80) : undefined,
    productCopy: parsed.productCopy ? String(parsed.productCopy).slice(0, 100) : undefined,
    productImageUrl: products[0]?.imageUrl ?? undefined,
    productPageUrl: products[0]?.productUrl ?? undefined,
    customerIncentive: parsed.customerIncentive ? String(parsed.customerIncentive).slice(0, 30) : undefined,
    products: products.length > 0
      ? products.slice(0, 3).map((p) => ({
          title: p.title,
          price: p.price ? `${p.price} €` : "",
          imageUrl: p.imageUrl ?? "",
          productUrl: p.productUrl ?? undefined,
        }))
      : undefined,
    heroUrl: bannerUrl ?? "",
    bgColor: palette.bg,
    textColor: palette.text,
    primaryColor: palette.primary,
    // Legal footer slots — render-time injection adds the compliance block
    // beneath the BRAND_BAR using these.
    storeName: storeName || undefined,
    storefrontUrl: storefrontUrl || undefined,
    legalName: legalName ?? undefined,
    legalAddress: legalAddress ?? undefined,
    legalCity: legalCity ?? undefined,
    legalCountry: legalCountry ?? undefined,
    privacyUrl: privacyUrl ?? undefined,
    brandLogoUrl: brandLogoUrl ?? undefined,
    brandLogoDarkUrl: brandLogoDarkUrl ?? undefined,
    // Generic unsubscribe stub — Send-time the campaign worker swaps this for a
    // per-recipient token. Placeholder URL keeps the link valid in previews.
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space"}/api/unsubscribe`,
    // Klaviyo-grade rich blocks — injected before the BRAND_BAR via the
    // PRODUCT_SPOTLIGHT / EDITORIAL_BLOCK helpers in template-skeletons.ts.
    // We marry the LLM's spotlight copy with the FIRST real Shopify product
    // (so the image and price come from the catalog, not from invention).
    spotlight: (() => {
      const llmSpot = parsed.spotlight && typeof parsed.spotlight === "object" ? parsed.spotlight as Record<string, unknown> : null;
      const llmTitle = typeof llmSpot?.title === "string" ? llmSpot.title : null;

      // Match the LLM's chosen product to the actual catalog row so the
      // displayed image, price and title all come from the SAME Shopify
      // product. Without this match the spotlight showed e.g. "divain.135"
      // as the title but products[0]'s bottle photo (which was 832) — drift.
      let realProduct = products[0];
      if (llmTitle && products.length > 0) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(llmTitle);
        const exact   = products.find((p) => norm(p.title) === target);
        const partial = !exact ? products.find((p) => norm(p.title).includes(target) || target.includes(norm(p.title))) : undefined;
        const matched = exact ?? partial;
        if (matched) realProduct = matched;
      }
      if (!realProduct?.imageUrl) return undefined;
      // Always use the REAL product's title (not the LLM's spelling) so
      // image+title+price are guaranteed consistent.
      return {
        title: realProduct.title.slice(0, 80),
        notes: typeof llmSpot?.notes === "string" ? String(llmSpot.notes).slice(0, 60).toUpperCase() : "",
        story: typeof llmSpot?.story === "string" ? String(llmSpot.story).slice(0, 320) : "",
        price: realProduct.price ? `${realProduct.price} €` : undefined,
        imageUrl: realProduct.imageUrl,
        productUrl: realProduct.productUrl ?? undefined,
        ctaLabel: typeof llmSpot?.ctaLabel === "string" ? String(llmSpot.ctaLabel).toUpperCase().slice(0, 30) : "DESCUBRIRLO",
      };
    })(),
    editorialBlock: (() => {
      const eb = parsed.editorialBlock && typeof parsed.editorialBlock === "object" ? parsed.editorialBlock as Record<string, unknown> : null;
      if (!eb) return undefined;
      const paras = Array.isArray(eb.paragraphs)
        ? (eb.paragraphs as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 10).slice(0, 3)
        : [];
      if (paras.length === 0) return undefined;
      return {
        eyebrow: typeof eb.eyebrow === "string" ? String(eb.eyebrow).toUpperCase().slice(0, 40) : "LA HISTORIA",
        headline: typeof eb.headline === "string" ? String(eb.headline).slice(0, 140) : "",
        paragraphs: paras.map((p) => p.slice(0, 320)),
      };
    })(),
    // ── LLM-DRIVEN BLOCKS (NEW) ─────────────────────────────────────────
    // Each block returns undefined when the LLM didn't populate it, so the
    // corresponding skeleton helper silently renders "". No hardcoded
    // fallbacks: better an empty section than fake content shipped to a
    // real recipient.
    brandPromise: (() => {
      const bp = parsed.brandPromise && typeof parsed.brandPromise === "object" ? parsed.brandPromise as Record<string, unknown> : null;
      const body = typeof bp?.body === "string" ? bp.body.trim() : "";
      if (!body) return undefined;
      return {
        eyebrow: typeof bp?.eyebrow === "string" ? String(bp.eyebrow).slice(0, 40) : undefined,
        body: body.slice(0, 220),
        caption: typeof bp?.caption === "string" ? String(bp.caption).slice(0, 60) : undefined,
      };
    })(),
    reasons: (() => {
      if (!Array.isArray(parsed.reasons)) return undefined;
      const items = (parsed.reasons as unknown[])
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({
          title: typeof r.title === "string" ? r.title.slice(0, 40) : "",
          copy:  typeof r.copy  === "string" ? r.copy.slice(0, 180) : "",
        }))
        .filter((r) => r.title && r.copy)
        .slice(0, 3);
      return items.length === 3 ? items : undefined;
    })(),
    fragranceNotes: (() => {
      const fn = parsed.fragranceNotes && typeof parsed.fragranceNotes === "object" ? parsed.fragranceNotes as Record<string, unknown> : null;
      if (!fn) return undefined;
      const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 3).map((s) => s.slice(0, 30)) : [];
      const top = arr(fn.top), heart = arr(fn.heart), base = arr(fn.base);
      if (top.length + heart.length + base.length === 0) return undefined;
      return { top, heart, base };
    })(),
    processBlock: (() => {
      const pb = parsed.processBlock && typeof parsed.processBlock === "object" ? parsed.processBlock as Record<string, unknown> : null;
      const paras = Array.isArray(pb?.paragraphs) ? (pb.paragraphs as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 15).slice(0, 2) : [];
      const headline = typeof pb?.headline === "string" ? pb.headline.trim() : "";
      if (!headline || paras.length === 0) return undefined;
      return {
        eyebrow: typeof pb?.eyebrow === "string" ? String(pb.eyebrow).slice(0, 40) : undefined,
        headline: headline.slice(0, 140),
        paragraphs: paras.map((p) => p.slice(0, 300)),
      };
    })(),
    founderNote: (() => {
      const fn = parsed.founderNote && typeof parsed.founderNote === "object" ? parsed.founderNote as Record<string, unknown> : null;
      const headline = typeof fn?.headline === "string" ? fn.headline.trim() : "";
      const body     = typeof fn?.body     === "string" ? fn.body.trim() : "";
      if (!headline || !body) return undefined;
      return {
        eyebrow: typeof fn?.eyebrow === "string" ? String(fn.eyebrow).slice(0, 40) : undefined,
        headline: headline.slice(0, 100),
        body: body.slice(0, 320),
      };
    })(),
    appBenefits: (() => {
      if (!Array.isArray(parsed.appBenefits)) return undefined;
      const items = (parsed.appBenefits as unknown[])
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({
          title: typeof r.title === "string" ? r.title.slice(0, 40) : "",
          copy:  typeof r.copy  === "string" ? r.copy.slice(0, 160) : "",
        }))
        .filter((r) => r.title && r.copy)
        .slice(0, 3);
      return items.length === 3 ? items : undefined;
    })(),
    urgencyReasons: (() => {
      if (!Array.isArray(parsed.urgencyReasons)) return undefined;
      const items = (parsed.urgencyReasons as unknown[])
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({
          title: typeof r.title === "string" ? r.title.slice(0, 40) : "",
          copy:  typeof r.copy  === "string" ? r.copy.slice(0, 160) : "",
        }))
        .filter((r) => r.title && r.copy)
        .slice(0, 3);
      return items.length === 3 ? items : undefined;
    })(),
    promoCode: (() => {
      const pc = parsed.promoCode && typeof parsed.promoCode === "object" ? parsed.promoCode as Record<string, unknown> : null;
      const code = typeof pc?.code === "string" ? pc.code.trim() : "";
      if (!code) return undefined;
      return {
        code: code.toUpperCase().slice(0, 20),
        label: typeof pc?.label === "string" ? String(pc.label).slice(0, 60) : undefined,
      };
    })(),
    // Trust items — pulled from Store config when available. We do NOT make
    // up shipping policies; if the store hasn't configured them the trust
    // bar simply doesn't render. Read from Store.trustItems (JSON) field —
    // null-safe so older stores without the column don't break.
    trustItems: trustItems.length > 0 ? trustItems : undefined,
    // ── PRODUCT-NARRATIVE BLOCKS (NEW) ──────────────────────────────────
    topPromoStrip: (() => {
      const tps = parsed.topPromoStrip && typeof parsed.topPromoStrip === "object" ? parsed.topPromoStrip as Record<string, unknown> : null;
      const text = typeof tps?.text === "string" ? tps.text.trim() : "";
      if (!text) return undefined;
      return {
        text: text.slice(0, 80),
        bgColor: typeof tps?.bgColor === "string" ? tps.bgColor : undefined,
        textColor: typeof tps?.textColor === "string" ? tps.textColor : undefined,
      };
    })(),
    splitNarrative: (() => {
      if (!Array.isArray(parsed.splitNarrative)) return undefined;
      const items = (parsed.splitNarrative as unknown[])
        .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
        .map((it, i) => ({
          // Wire each split's image to a different real product photo from
          // the catalog so consecutive splits visually rotate. Falls back
          // to products[0] when not enough catalog entries.
          imageUrl: products[i % Math.max(1, products.length)]?.imageUrl ?? products[0]?.imageUrl ?? "",
          tagline: typeof it.tagline === "string" ? it.tagline.slice(0, 80) : "",
          body:    typeof it.body    === "string" ? it.body.slice(0, 220)   : "",
          ctaLabel: typeof it.ctaLabel === "string" ? String(it.ctaLabel).toUpperCase().slice(0, 30) : "DESCUBRIR",
          ctaUrl: products[i % Math.max(1, products.length)]?.productUrl ?? storefrontUrl ?? "#",
        }))
        .filter((it) => it.tagline && it.body && it.imageUrl)
        .slice(0, 3);
      return items.length > 0 ? items : undefined;
    })(),
    collectionCallout: (() => {
      const cc = parsed.collectionCallout && typeof parsed.collectionCallout === "object" ? parsed.collectionCallout as Record<string, unknown> : null;
      const bridgeText = typeof cc?.bridgeText === "string" ? cc.bridgeText.trim() : "";
      const bodyText   = typeof cc?.bodyText   === "string" ? cc.bodyText.trim()   : "";
      const ctaLabel   = typeof cc?.ctaLabel   === "string" ? cc.ctaLabel.trim()   : "";
      if (!bridgeText || !bodyText || !ctaLabel) return undefined;
      return {
        bridgeText: bridgeText.slice(0, 220),
        bodyText: bodyText.slice(0, 280),
        italicCloser: typeof cc?.italicCloser === "string" ? cc.italicCloser.slice(0, 180) : undefined,
        ctaLabel: ctaLabel.toUpperCase().slice(0, 30),
        ctaUrl: storefrontUrl ? `${storefrontUrl}/?utm_source=sendify&utm_medium=email&utm_content=collection-callout` : "#",
      };
    })(),
    // Service callout — pulled from Store.brandPalette.serviceCallout JSON.
    // When the store hasn't configured a recurring service block (e.g. divain's
    // Try&Buy), it doesn't render. No LLM invention — this must be real.
    serviceCallout: serviceCalloutFromStore ?? undefined,
    // Brand accent colour — used as the service callout bg + product-narrative
    // CTAs. Reads Store.brandPalette.accent (when set), else falls back to
    // primary so the design degrades gracefully on stores without a config.
    accentColor: accentColorFromStore,
  };

  const mjml = renderSkeleton(layoutPattern, slots);

  return {
    subject, preheader, mjml,
    layoutPattern,
    bannerPrompt,
    bannerAssetId,
    bannerUrl,
    bannerError,
    modelUsed: model,
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}
