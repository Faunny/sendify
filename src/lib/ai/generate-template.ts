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
  "bannerPrompt": "<REQUIRED for every layout except countdown-urgency. Describe an editorial fashion scene featuring a REAL-LOOKING WOMAN MODEL — NO products in the photo, no bottles, no boxes, no labels. The actual divain product is displayed SEPARATELY in the email (in the 'Selección destacada' section), not in this photo. Treat this prompt like a magazine cover shoot of a model.\\n\\nDivain's aesthetic is editorial fashion photography: woman on a beach, in a forest, on sand dunes, by the sea, in a garden. Dressed naturally (linen, swimsuit, sundress, knitwear) depending on the brief's season.\\n\\n50-80 words. Describe: the woman, her wardrobe, the setting, the mood, the light, the colour palette. ZERO text/logos/captions/numbers/products in the image.\\n\\nGood examples:\\n - 'A woman in her late twenties in a white linen sundress on warm sand at golden hour, looking out to sea, eyes half-closed. Soft warm light, shallow depth of field, sandy and ivory palette.'\\n - 'A woman in her thirties walking through a pine forest in a knit cardigan, pausing to look up. Autumn light through trees, warm browns and forest greens, magazine fashion editorial.'\\n - 'A young woman reclining on white dunes at sunset. Peaceful expression, hair pulled back, soft pastel sky, refined and aspirational.'>"
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
    : `REAL CATALOG SAMPLE (use these exact product names if your chosen pattern needs them):\n${products.map((p, i) => `${i + 1}. ${p.title}${p.price ? ` · ${p.price}` : ""}`).join("\n")}`;

  return `BRIEF:
"""
${input.brief}
"""
${pillarHint}
${toneHint}
${langHint}

${catalogBlock}

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

function buildHeroPrompt(layoutPattern: string, llmPrompt: string, hasProductRef: boolean): string {
  const seed = (llmPrompt || "").trim();

  // With a real product reference (the user's actual Divain bottle), every
  // pattern places that bottle into a scene matched to the layout's mood.
  if (hasProductRef) {
    switch (layoutPattern) {
      case "lifestyle-hero":
        return `Editorial luxury perfume advertising photograph. ${seed}. A real woman model interacts naturally with the perfume bottle (holds it, looks at it, sets it down on a surface near her). Magazine-cover quality, 85mm lens, shallow depth of field, soft natural light, warm refined mood. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "big-number-hero":
        return `Minimalist editorial still life: the perfume bottle from the reference placed on ${seed || "a warm-toned surface with soft natural light, perhaps with a single bloom or a length of silk nearby"}. Clean composition with negative space on one side (text will overlay there in the email). Magazine quality, soft directional light. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "premium-launch":
        return `Premium editorial product photograph: the perfume bottle from the reference held in a model's hand, or resting on a refined surface (marble, dark velvet, polished wood). Close-crop framing showing the bottle prominently with a human element (a hand, a sleeve, a strand of hair). ${seed}. Magazine campaign aesthetic, directional light, refined. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "countdown-urgency":
        return `Cinematic editorial photograph with subtle tension: the perfume bottle from the reference at the heart of the composition — on a table being approached, in a hand mid-motion, or in dramatic golden-hour light. ${seed}. Magazine quality, slight motion or anticipation. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "app-promo-gradient":
        return `Modern lifestyle photograph: a model's hand holding a smartphone next to (or just behind) the perfume bottle from the reference, both resting on a refined surface. Soft natural daylight, minimal aesthetic, the phone screen is blank/dark. ${seed}. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "product-grid-editorial":
        return `Wide editorial environmental photograph: a real woman model in a refined setting (interior, garden, terrace), with the perfume bottle from the reference visible on a surface in the scene (vanity, table, bedside). ${seed}. Magazine quality, soft natural light. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "brand-anthology":
        return `Cinematic editorial portrait: a real woman model in a slow contemplative moment, with the perfume bottle from the reference resting nearby (on a windowsill, dresser, or in her hand). Beautifully lit (window light, golden hour, candlelight). Magazine quality, refined and timeless. ${seed}. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

      case "winback-empathic":
        return `Warm intimate editorial photograph: a real woman model in a quiet personal moment at home, with the perfume bottle from the reference visible nearby (on a vanity, on a side table, in her hand). Soft golden light, emotional warmth, magazine quality. ${seed}. ${KEEP_PRODUCT_RULE} ${NO_TEXT_RULE}`;

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

  const products = await loadProductHints(input.storeSlug, input.pillar);

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
