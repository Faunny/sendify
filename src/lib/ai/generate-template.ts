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
  }
}

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
// user explicit ask: the real Divain bottle must appear in the hero.
const KEEP_PRODUCT_RULE = "The perfume bottle from the attached reference image MUST appear in this scene. Preserve it EXACTLY: same glass shape, same color, same label artwork, same cap. Do NOT redesign, restyle, recolor, or reinterpret the bottle. Compose the rest of the scene (person, surface, props, lighting) around the bottle as if it were photographed in place.";

// Exported so the asset-pool refill cron can call into the same prompt
// library (pattern-aware briefs that produce Higgsfield-quality output).
export function buildHeroPromptForLayout(layoutPattern: string, llmPrompt: string, hasProductRef: boolean): string {
  return buildHeroPrompt(layoutPattern, llmPrompt, hasProductRef);
}

// Pool of composition variants used to break the "aspirational woman holding
// the bottle in front of her" monotony. Each call picks one randomly so
// consecutive emails feel different even with the same layout.
const LIFESTYLE_COMPOSITIONS = [
  "a real woman in her late 20s on a warm-toned sandy beach at golden hour, the bottle resting on driftwood beside her",
  "a real woman in a knit cardigan inside a sun-lit Mediterranean apartment, the bottle on a marble side table, her hand reaching for it",
  "a real woman in a linen sundress walking through a wildflower field, the bottle held casually at her side",
  "a real woman seated on a stone garden bench at dusk, the bottle on the seat next to her, soft purple light",
  "a real woman in a silk robe on a balcony with a sea view, the bottle on a small iron table with espresso, morning light",
  "a real woman in a forest clearing in autumn, knitwear, the bottle on a moss-covered log, gold leaf light",
  "a real woman in front of an open window with sheer linen curtains, the bottle on the windowsill, soft white light",
  "a real woman crouched at a stone fountain in an old Spanish patio, the bottle on the edge, warm shade",
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
  "the bottle on a candlelit table at dusk, a half-empty espresso cup beside it, low warm light",
  "the bottle at the edge of a marble counter under a single overhead spot, deep shadows on the surrounding surface",
  "the bottle in a hand mid-motion reaching across a darkened mahogany table, ambient bar light",
  "the bottle on a worn leather chair beside an unmade bed at golden hour, low sun cutting through linen curtains",
  "the bottle on a brass tray with a wax-sealed envelope, late-night warm lamp glow",
  "the bottle on a bathroom vanity with steam softening the mirror, a robe slipping off a hook in the background",
  "the bottle on a windowsill at last light, city skyline blurred in the distance, single pendant lamp on inside",
  "the bottle on a velvet bench in a darkened dressing room, single light beam from above, theatrical mood",
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
  "a real woman at a window in soft morning light, the bottle on the inner sill beside her, looking out, no eye contact",
  "a real woman reclining on a chesterfield sofa in a warm-toned living room, the bottle on a brass side table beside her",
  "a real woman at a vanity tying her hair up, the bottle reflected in the mirror on the surface in front of her",
  "a real woman in a kitchen at golden hour, hands resting on the counter, the bottle and a single fig beside her",
  "a real woman seated on a wooden chair in a stone-walled patio, candle on the table, the bottle just within reach",
  "a real woman at a desk by candlelight writing a letter, the bottle and a single rose stem beside her hand",
  "a real woman silhouetted in a doorway with sun behind her, the bottle on the threshold inside the room",
  "a real woman lying on her side on white sheets at dawn, the bottle on the bedside table, soft cool light",
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

function buildHeroPrompt(layoutPattern: string, llmPrompt: string, hasProductRef: boolean): string {
  const seed = (llmPrompt || "").trim();

  // With a real product reference (the user's actual Divain bottle), every
  // pattern places that bottle into a scene matched to the layout's mood.
  if (hasProductRef) {
    switch (layoutPattern) {
      case "lifestyle-hero": {
        const comp = pickRandom(LIFESTYLE_COMPOSITIONS);
        return `Editorial luxury perfume advertising photograph: ${comp}. ${seed}. Magazine-cover quality, 85mm lens, shallow depth of field, warm refined mood. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "big-number-hero": {
        const comp = pickRandom(STILL_LIFE_COMPOSITIONS);
        return `Minimalist editorial still life: ${comp}. ${seed}. Clean composition with negative space on one side (text will overlay there in the email). Magazine quality. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "premium-launch": {
        const comp = pickRandom(CLOSE_CROP_COMPOSITIONS);
        return `Premium editorial product photograph, close-crop: ${comp}. ${seed}. Magazine campaign aesthetic, directional light, refined and quiet. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "countdown-urgency": {
        const comp = pickRandom(URGENCY_COMPOSITIONS);
        return `Cinematic editorial photograph with subtle tension: ${comp}. ${seed}. Magazine quality, slight anticipation, low-key warm light. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "app-promo-gradient": {
        const comp = pickRandom(APP_COMPOSITIONS);
        return `Modern lifestyle photograph: ${comp}. ${seed}. Soft natural daylight, minimal aesthetic, phone screen blank/dark. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "product-grid-editorial": {
        const comp = pickRandom(ENVIRONMENT_COMPOSITIONS);
        return `Wide editorial environmental photograph: ${comp}. ${seed}. Magazine quality, soft natural light, refined. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "brand-anthology": {
        const comp = pickRandom(INTERIOR_COMPOSITIONS);
        return `Cinematic editorial portrait: ${comp}. ${seed}. Magazine quality, refined and timeless, beautifully lit. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      case "winback-empathic": {
        const comp = pickRandom(EMPATHIC_COMPOSITIONS);
        return `Warm intimate editorial photograph: ${comp}. ${seed}. Soft golden light, emotional warmth, magazine quality. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
      }

      default:
        return `Editorial luxury perfume advertising photograph: ${seed}. Real model interacting with the perfume bottle from the reference image. Magazine quality, soft natural light, refined mood. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;
    }
  }

  // No product reference available — generate a clean editorial scene without
  // any fabricated bottle (since AI-invented bottles look generic and don't
  // match the brand). Person + setting only.
  switch (layoutPattern) {
    case "lifestyle-hero":
      return `Editorial fashion photograph in the style of high-end perfume brand advertising. ${seed}. Real woman model, natural skin, candid expression, magazine-cover quality, 85mm lens, shallow depth of field, soft natural light, refined mood. No products in frame. ${NO_TEXT_RULE}`;

    case "big-number-hero":
      return `Minimalist editorial still life: ${seed}. Abstract textural composition — silk, marble, blooms, warm linen — refined and quiet, with negative space for text overlay. ${NO_TEXT_RULE}`;

    default:
      return `Editorial fashion photograph: ${seed}. Real model, magazine quality, soft natural light, refined mood. ${NO_TEXT_RULE}`;
  }
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
      max_tokens: 1500,
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
  const shouldGenBanner = input.generateBanner !== false && bannerPrompt.length > 10;
  if (shouldGenBanner) {
    try {
      // 0) Library-first reuse. Strict matching: the asset MUST be tagged with
      // BOTH the exact layoutPattern AND a version marker. Bumping the marker
      // when we change prompt rules invalidates the old library automatically
      // (no DB migration needed) because hasEvery requires the current tag to
      // be present and old assets don't have it.
      //
      // v4 = bottle FROM the real Shopify product photo is composed into the
      // hero scene via Gemini Nano Banana. Pre-v4 assets either had no bottle
      // or had an AI-invented bottle, neither of which we want anymore.
      const PROMPT_VERSION = "v4-with-product";
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
      const heroOnlyPrompt = buildHeroPrompt(layoutPattern, bannerPrompt, !!productRefUrl);

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
  } else if (!bannerPrompt && input.generateBanner !== false) {
    bannerError = "LLM did not return a bannerPrompt (pattern likely doesn't need one)";
  }

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
