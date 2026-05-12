// Auto-drafter — generates a complete campaign draft from a promotion calendar entry.
//
// Triggered three ways:
// 1. **Cron** — every hour, scan promotions where `today + leadDays >= dateByCountry[market]`
//    for stores that sell into that market. For each match without an existing campaign,
//    call `draftCampaignFromPromotion(promotionId, storeId)`.
// 2. **Manual** — user clicks "Auto-draft" on a calendar entry.
// 3. **External push** — upstream promotions tool POSTs to /api/promotions/webhook, which
//    upserts the Promotion and optionally fires an auto-draft immediately.
//
// The drafter is intentionally a pure function over (Promotion, Store, ProductCatalog) so
// it stays testable. It returns a CampaignDraft; the caller (cron worker or API route)
// persists it in `Campaign` with status `PENDING_APPROVAL`.

import { Block, Document, DEFAULT_DOCUMENT } from "./builder";
import type { MockProduct, MockPromotion, MockStore } from "./mock";
import { estimateCampaignCost } from "./cost";
import { LANGUAGES, languagesForCountry } from "./languages";

export type CampaignDraft = {
  name: string;
  subject: string;
  preheader: string;
  storeId: string;
  promotionId: string;
  segmentIds: string[];
  languages: string[];      // BCP-47 codes the campaign fans out to
  market: string;           // primary market the prices/copy default to
  scheduledFor: Date;
  document: Document;
  bannerPrompt?: string;
  estimatedRecipients: number;
  estimatedCost: number;
  draftReason: string;
  draftSource: "AUTO_PROMOTION" | "AUTO_LLM";
  draftLlmPrompt?: string;
};

// LLM brief used by `generateCopy` when OPENAI_API_KEY is set.
// Falls back to a deterministic high-quality template otherwise so dev/demo never breaks.
function buildLlmPrompt(promo: MockPromotion, store: MockStore, market: string) {
  return `You are Divain's senior copywriter. Voice: confident, refined, warm. Audience: ${market} customers of ${store.name}.
Promotion: ${promo.name} · scheduled date ${promo.dateByCountry[market]}.
Write a campaign brief as JSON with these fields:
  - subject: max 60 chars, no emoji, in ${store.defaultLanguage}
  - preheader: max 90 chars, in ${store.defaultLanguage}
  - heroHeading: max 50 chars, evocative not promotional, in ${store.defaultLanguage}
  - heroSubheading: max 80 chars, in ${store.defaultLanguage}
  - bodyParagraph: one paragraph, in ${store.defaultLanguage}
  - cta: 2-3 words, in ${store.defaultLanguage}
  - bannerPrompt: a Gemini image prompt for the hero banner. No text in image. Luxury minimal. Brand palette: ${Object.values(store.brand.palette).join(", ")}.
Do not mention competitors. Do not invent products.`;
}

// Deterministic fallback copy keyed on (promo.name, language).
// Voice matches the real Divain Klaviyo campaigns: short imperative subjects, big-number
// or value-first hero, brand bar of pillars below, CTA in uppercase gold pill.
// Sized for the demo; in production GPT-4 generates against this same brief.
const FALLBACK_COPY: Record<string, Record<string, ReturnType<typeof shape>>> = {
  "Día de la Madre": {
    "es-ES": shape({
      subject: "Para ella, perfume a 11,99€",
      preheader: "Selección Día de la Madre · envío gratis +30€",
      heroHeading: "Todos los perfumes a",
      heroSubheading: "11,99€",
      body: "Una selección curada para regalar este Día de la Madre. 100ml. Larga duración. El detalle que sí va a usar.",
      cta: "COMPRAR AHORA",
      banner: "Editorial Mother's Day scene · warm gold and ivory · soft natural light · single perfume bottle held by a model · luxury minimal",
    }),
    "es-MX": shape({
      subject: "Para ella, perfume a $249 MXN",
      preheader: "Selección Día de las Madres · envío gratis +$500",
      heroHeading: "Todos los perfumes a",
      heroSubheading: "$249",
      body: "Una selección curada para regalar este Día de las Madres. 100ml. Larga duración. El detalle que sí va a usar.",
      cta: "COMPRAR AHORA",
      banner: "Editorial Mother's Day scene · warm gold and ivory · soft natural light · single perfume bottle held by a model · luxury minimal",
    }),
    "fr-FR": shape({
      subject: "Pour elle, un parfum à 11,99€",
      preheader: "Sélection Fête des Mères · livraison offerte dès 30€",
      heroHeading: "Tous les parfums à",
      heroSubheading: "11,99€",
      body: "Une sélection pensée pour la Fête des Mères. 100ml. Longue tenue. Le cadeau juste, sans excès.",
      cta: "ACHETER MAINTENANT",
      banner: "Editorial Mother's Day scene · warm gold and ivory · soft natural light · single perfume bottle held by a model · luxury minimal",
    }),
    "en-GB": shape({
      subject: "For her, a fragrance at £11.99",
      preheader: "Mother's Day edit · free shipping over £25",
      heroHeading: "All perfumes at",
      heroSubheading: "£11.99",
      body: "A curated edit for Mother's Day. 100ml. Long-lasting. The right gift, without the markup.",
      cta: "SHOP NOW",
      banner: "Editorial Mother's Day scene · warm gold and ivory · soft natural light · single perfume bottle held by a model · luxury minimal",
    }),
    "en-US": shape({
      subject: "For her, a fragrance at $14.99",
      preheader: "Mother's Day edit · free shipping over $40",
      heroHeading: "All perfumes at",
      heroSubheading: "$14.99",
      body: "A curated edit for Mother's Day. 3.4 fl oz. Long-lasting. The right gift, without the markup.",
      cta: "SHOP NOW",
      banner: "Editorial Mother's Day scene · warm gold and ivory · soft natural light · single perfume bottle held by a model · luxury minimal",
    }),
  },
  "Día del Padre": {
    "es-ES": shape({
      subject: "Para él, perfume a 11,99€",
      preheader: "Selección Día del Padre · envío gratis +30€",
      heroHeading: "Todos los perfumes a",
      heroSubheading: "11,99€",
      body: "Maderas, frescor, persistencia. Los aromas masculinos que más se regalan, al precio que ya conoces.",
      cta: "COMPRAR AHORA",
      banner: "Father's Day editorial · woody confident · deep navy and amber · single perfume bottle held by a model · luxury minimal",
    }),
  },
  "San Valentín": {
    "es-ES": shape({
      subject: "Para regalar (a quien sea) a 11,99€",
      preheader: "Selección San Valentín · envío 24h",
      heroHeading: "Todos los perfumes a",
      heroSubheading: "11,99€",
      body: "Una selección pensada para regalar. 100ml. Larga duración. El detalle perfecto.",
      cta: "ENCUÉNTRALO",
      banner: "Valentine's editorial · warm gold tones · soft focus · single perfume bottle held by a model",
    }),
  },
  "Black Friday": {
    "es-ES": shape({
      subject: "Black Friday: 55% de descuento",
      preheader: "Sólo 48 horas · stock limitado · envío gratis",
      heroHeading: "55%",
      heroSubheading: "DE DESCUENTO",
      body: "En todos los perfumes. Sólo 48 horas o hasta fin de stock.",
      cta: "COMPRAR AHORA",
      banner: "Black Friday editorial · single perfume bottle held by a model on a moody background · dramatic side lighting · cinematic",
    }),
    "fr-FR": shape({
      subject: "Black Friday : 55% de réduction",
      preheader: "48 heures · stock limité · livraison offerte",
      heroHeading: "55%",
      heroSubheading: "DE RÉDUCTION",
      body: "Sur tous les parfums. 48 heures seulement ou jusqu'à rupture de stock.",
      cta: "ACHETER MAINTENANT",
      banner: "Black Friday editorial · single perfume bottle held by a model on a moody background · dramatic side lighting · cinematic",
    }),
  },
};

function shape<T extends Record<string, string>>(t: T) { return t; }

// Pick featured products from the store: top by inventory + matching the season heuristic.
// In production this calls a recommender (top sellers last 7d, restocked, on-trend, etc.)
function pickFeaturedProducts(products: MockProduct[], storeId: string, n = 3): MockProduct[] {
  return products
    .filter((p) => p.storeId === storeId && p.inventoryQty > 50)
    .sort((a, b) => b.inventoryQty - a.inventoryQty)
    .slice(0, n);
}

export function draftCampaignFromPromotion(args: {
  promotion: MockPromotion;
  store: MockStore;
  products: MockProduct[];
  today?: Date;
  audienceEstimate?: number;
  segmentIds?: string[];
}): CampaignDraft {
  const { promotion, store, products } = args;
  const market = store.countryCode;
  const date = promotion.dateByCountry[market];
  if (!date) throw new Error(`Promotion ${promotion.name} has no date for market ${market}`);

  const scheduledFor = new Date(`${date}T08:00:00Z`);
  const leadDays = Math.max(
    1,
    Math.round((scheduledFor.getTime() - (args.today ?? new Date()).getTime()) / 86_400_000)
  );

  // Pick copy: LLM in production, fallback table here for the demo.
  const sourceLang = store.defaultLanguage;
  const copy = FALLBACK_COPY[promotion.name]?.[sourceLang] ?? {
    subject: promotion.name,
    preheader: "",
    heroHeading: promotion.name,
    heroSubheading: "",
    body: "",
    cta: "Descubrir",
    banner: `${promotion.name} editorial banner, luxury minimal, brand palette ${Object.values(store.brand.palette).join(", ")}, no text`,
  };

  const featured = pickFeaturedProducts(products, store.id, 3);
  const targetLanguages = Array.from(
    new Set(
      store.markets.flatMap((m) => languagesForCountry(m).map((l) => l.code)).concat([sourceLang])
    )
  );

  // Build the email document. Matches the Divain real-email structure:
  //   1. Big-number hero with full-bleed background image (lifestyle shot)
  //   2. Featured product grid
  //   3. Brand pillars bar (PARFUMS · CARE · HOME · RITUAL)
  //   4. App download promo
  //   5. Footer (gold gradient with legal entity)
  const blocks: Block[] = [
    { id: cuid(), type: "big-number", props: {
        // No hardcoded background image — the banner is generated by Gemini Nano Banana
        // at render time using `bannerPrompt` below, then uploaded to S3 and the URL
        // substituted here. Until generation runs, the canvas shows a solid color block.
        number: copy.heroHeading,
        subtitle: copy.heroSubheading,
        tagline: copy.body,
        bgImageUrl: "",
        bgColor: "#F0C95C",
        textColor: "#FFFFFF",
        ctaLabel: copy.cta,
        ctaHref: `${store.storefrontUrl}/collections/${slugify(promotion.name)}`,
        ctaStyle: "black",
    } },
    { id: cuid(), type: "product-grid", props: {
        productIds: featured.map((p) => p.id),
        columns: 3,
        market,
    } },
    { id: cuid(), type: "brand-pillars", props: {
        pillarSlugs: ["parfums", "care", "home", "ritual"],
        bgColor: "#000000",
        textColor: "#FFFFFF",
    } },
    { id: cuid(), type: "app-promo", props: {
        // App screenshot — uploaded once to S3 by the user, then linked by asset id.
        imageUrl: "",
        heading: appPromoCopy(sourceLang).heading,
        body:    appPromoCopy(sourceLang).body,
        ctaLabel:appPromoCopy(sourceLang).cta,
        ctaHref: "https://onelink.to/43swmh",
    } },
    { id: cuid(), type: "footer", props: { storeId: store.id } },
  ];

  const document: Document = {
    ...DEFAULT_DOCUMENT,
    bgColor: store.brand.palette.bg,
    contentBgColor: "#FFFFFF",
    blocks,
  };

  const recipients = args.audienceEstimate ?? Math.round(store.id === "st_1" ? 287_410 : 100_000);
  const cost = estimateCampaignCost({
    recipients,
    languages: targetLanguages.length,
    cacheHitRate: 0.71,
    imagesGenerated: 1,
  });

  return {
    name: `${promotion.name} — ${store.name.replace("Divain Parfums ", "").replace("Divain ", "")}`,
    subject: copy.subject,
    preheader: copy.preheader,
    storeId: store.id,
    promotionId: promotion.id,
    segmentIds: args.segmentIds ?? [],
    languages: targetLanguages,
    market,
    scheduledFor,
    document,
    bannerPrompt: copy.banner,
    estimatedRecipients: recipients,
    estimatedCost: cost.total,
    draftReason: `${promotion.name} · ${leadDays} day${leadDays === 1 ? "" : "s"} before send · auto-drafted`,
    draftSource: "AUTO_PROMOTION",
    draftLlmPrompt: process.env.OPENAI_API_KEY ? buildLlmPrompt(promotion, store, market) : undefined,
  };
}

function appPromoCopy(lang: string): { heading: string; body: string; cta: string } {
  if (lang.startsWith("es-MX")) return { heading: "¿YA TIENES LA NUEVA APP?", body: "Beneficios exclusivos y ofertas que no verás en el sitio.", cta: "DESCARGAR AHORA" };
  if (lang.startsWith("es"))    return { heading: "¿AÚN NO TIENES LA NUEVA APP?", body: "Beneficios exclusivos y ofertas que no verás en la web.", cta: "DESCARGAR AHORA" };
  if (lang.startsWith("fr"))    return { heading: "VOUS N'AVEZ PAS ENCORE LA NOUVELLE APP ?", body: "Avantages exclusifs et offres que vous ne verrez pas sur le site.", cta: "TÉLÉCHARGER MAINTENANT" };
  if (lang.startsWith("de"))    return { heading: "HAST DU DIE NEUE APP NOCH NICHT?", body: "Exklusive Vorteile und Angebote, die es auf der Website nicht gibt.", cta: "JETZT HERUNTERLADEN" };
  if (lang.startsWith("it"))    return { heading: "NON HAI ANCORA LA NUOVA APP?", body: "Vantaggi esclusivi e offerte che non vedrai sul sito.", cta: "SCARICA ORA" };
  if (lang.startsWith("pt"))    return { heading: "AINDA NÃO TENS A NOVA APP?", body: "Benefícios exclusivos e ofertas que não verás no site.", cta: "DESCARREGAR AGORA" };
  return { heading: "GOT THE NEW APP YET?", body: "Exclusive benefits and offers you won't find on the website.", cta: "DOWNLOAD NOW" };
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cuid() {
  return "b_" + Math.random().toString(36).slice(2, 10);
}
