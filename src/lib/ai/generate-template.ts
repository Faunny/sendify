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
};

type StorePalette = { primary?: string; accent?: string; bg?: string; text?: string };
const DEFAULT_PALETTE: Required<StorePalette> = {
  primary: "#000000",
  accent:  "#000000",
  bg:      "#FFFFFF",
  text:    "#1A1A1A",
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
};

async function loadProductHints(storeSlug: string | undefined, pillar: string | undefined): Promise<ProductHint[]> {
  if (!storeSlug) return [];
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, countryCode: true, currency: true },
  });
  if (!store) return [];

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
      handle: true, title: true, imageUrl: true,
      variants: {
        take: 1,
        select: { prices: { where: { market: store.countryCode }, take: 1, select: { price: true, currency: true } } },
      },
    },
  }).catch(() => []);

  return products.map((p) => ({
    handle: p.handle,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.variants[0]?.prices[0]?.price?.toString() ?? null,
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
  "bannerPrompt": "<50-80 word prompt for Gemini image gen. PHOTOGRAPH ONLY. The image will be reused across 22 language translations, so it MUST contain ZERO text/letters/numbers/prices/percentages/dates/logos/watermarks/captions/signage. Pure photographic content — describe subject, setting, mood, light. Example: 'A woman in her thirties on warm sand at golden hour, white linen dress, looking pensively at the sea. Soft warm light, shallow depth of field, muted ochre and ivory palette.' If layoutPattern is countdown-urgency or premium-launch and a photo would distract, return empty string for bannerPrompt.>"
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

export async function generateTemplate(input: TemplateGenInput): Promise<TemplateGenOutput> {
  // Resolve store palette → drives skeleton colors.
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
      const img = await generateBannerAny({
        prompt: bannerPrompt,
        aspectRatio: "3:2",
        brandHints: {
          palette: [palette.primary, palette.bg, palette.text].filter(Boolean),
          style: "editorial lifestyle photography for divain perfume brand",
          avoidText: true,
        },
        quality: input.imageQuality ?? "medium",
        preferredModel: input.imageModelOverride,
      });
      const bytes = Buffer.from(img.base64, "base64");
      const asset = await prisma.asset.create({
        data: {
          name: `hero-${layoutPattern}-${Date.now()}`,
          kind: "IMAGE",
          mimeType: img.mimeType,
          data: bytes,
          sizeBytes: bytes.length,
          tags: ["ai-generated", "hero", input.storeSlug ?? "global"],
          prompt: bannerPrompt,
          generatedBy: img.provider,
        },
        select: { id: true },
      });
      bannerAssetId = asset.id;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
      bannerUrl = `${appUrl}/api/assets/${asset.id}`;
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
    ctaUrl: "#",
    productName: parsed.productName ? String(parsed.productName).slice(0, 80) : undefined,
    productCopy: parsed.productCopy ? String(parsed.productCopy).slice(0, 100) : undefined,
    productImageUrl: products[0]?.imageUrl ?? undefined,
    customerIncentive: parsed.customerIncentive ? String(parsed.customerIncentive).slice(0, 30) : undefined,
    products: products.length > 0
      ? products.slice(0, 3).map((p) => ({
          title: p.title,
          price: p.price ? `${p.price} €` : "",
          imageUrl: p.imageUrl ?? "",
        }))
      : undefined,
    heroUrl: bannerUrl ?? "",
    bgColor: palette.bg,
    textColor: palette.text,
    primaryColor: palette.primary,
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
