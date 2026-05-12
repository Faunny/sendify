// Deterministic mock data used by the UI while real Shopify/SES/DB integrations come online.
// Designed so the dashboard feels alive and decisions can be validated visually before wiring real data.

import { LANGUAGES } from "./languages";

export type LegalEntity = {
  legalName: string;
  vatNumber: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  supportEmail: string;
  supportPhone: string;
  privacyUrl: string;
  termsUrl: string;
  cookiesUrl: string;
};

export type BrandKit = {
  logoUrl: string;
  logoDarkUrl?: string;
  palette: { primary: string; accent: string; bg: string; text: string };
  fontHeading: string;
  fontBody: string;
};

export type MockStore = {
  id: string;
  slug: string;
  name: string;
  shopifyDomain: string;
  storefrontUrl: string;
  countryCode: string;
  defaultLanguage: string;
  currency: string;
  markets: string[];
  productCount: number;
  customers: number;
  subscribed: number;
  legal: LegalEntity;
  brand: BrandKit;
};

// 4 geographic Shopify Plus stores, each selling the FULL divain catalog across all 4 pillars
// (PARFUMS · CARE · HOME · RITUAL). Each store is a separate legal entity ("sociedad").
export const STORES: MockStore[] = [
  {
    id: "st_1", slug: "divain-europa", name: "divain · Europa",
    shopifyDomain: "divain-europa.myshopify.com", storefrontUrl: "https://divainparfums.com",
    countryCode: "ES", defaultLanguage: "es-ES", currency: "EUR",
    markets: ["ES", "PT", "AD", "FR", "BE", "NL", "DE", "AT", "IT", "IE", "LU", "CH", "PL", "SE", "DK", "FI", "NO", "CZ", "RO", "HU", "BG", "SK", "SI", "GR"],
    productCount: 1024, customers: 612_330, subscribed: 421_410,
    legal: {
      legalName: "Divain Parfums, S.L.",
      vatNumber: "B-12345678",
      address: "Polígono Industrial Las Atalayas, Calle de la Innovación 24",
      postalCode: "03114", city: "Alicante", country: "Spain",
      supportEmail: "divain@divainparfums.com", supportPhone: "+34 965 12 34 56",
      privacyUrl: "https://divainparfums.com/politica-privacidad",
      termsUrl: "https://divainparfums.com/condiciones-de-venta",
      cookiesUrl: "https://divainparfums.com/politica-cookies",
    },
    brand: {
      logoUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/166aac11-32b2-41f4-8239-0f0a5d5e6c2d.png",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_2", slug: "divain-uk", name: "divain · UK",
    shopifyDomain: "divain-uk.myshopify.com", storefrontUrl: "https://divainparfums.co.uk",
    countryCode: "GB", defaultLanguage: "en-GB", currency: "GBP",
    markets: ["GB", "IE"], productCount: 612, customers: 124_500, subscribed: 82_100,
    legal: {
      legalName: "Divain UK Ltd.",
      vatNumber: "GB 123 4567 89",
      address: "Suite 4, 71 Shelton Street, Covent Garden",
      postalCode: "WC2H 9JQ", city: "London", country: "United Kingdom",
      supportEmail: "hello@divainparfums.co.uk", supportPhone: "+44 20 7946 0123",
      privacyUrl: "https://divainparfums.co.uk/privacy",
      termsUrl: "https://divainparfums.co.uk/terms",
      cookiesUrl: "https://divainparfums.co.uk/cookies",
    },
    brand: {
      logoUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/166aac11-32b2-41f4-8239-0f0a5d5e6c2d.png",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_3", slug: "divain-na", name: "divain · USA + Canada",
    shopifyDomain: "divain-na.myshopify.com", storefrontUrl: "https://divainparfums.co",
    countryCode: "US", defaultLanguage: "en-US", currency: "USD",
    markets: ["US", "CA"], productCount: 540, customers: 184_500, subscribed: 121_800,
    legal: {
      legalName: "Divain North America, Inc.",
      vatNumber: "EIN 88-1234567",
      address: "1209 Orange Street",
      postalCode: "19801", city: "Wilmington, DE", country: "United States",
      supportEmail: "help@divainparfums.co", supportPhone: "+1 (305) 555 0142",
      privacyUrl: "https://divainparfums.co/privacy",
      termsUrl: "https://divainparfums.co/terms",
      cookiesUrl: "https://divainparfums.co/cookies",
    },
    brand: {
      logoUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/166aac11-32b2-41f4-8239-0f0a5d5e6c2d.png",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_4", slug: "divain-mx", name: "divain · México",
    shopifyDomain: "divain-mx.myshopify.com", storefrontUrl: "https://divainparfums.mx",
    countryCode: "MX", defaultLanguage: "es-MX", currency: "MXN",
    markets: ["MX"], productCount: 480, customers: 96_220, subscribed: 64_440,
    legal: {
      legalName: "Divain México, S.A. de C.V.",
      vatNumber: "RFC DMX240101AB1",
      address: "Av. Paseo de la Reforma 222, Col. Juárez",
      postalCode: "06600", city: "Ciudad de México", country: "México",
      supportEmail: "hola@divainparfums.mx", supportPhone: "+52 55 1234 5678",
      privacyUrl: "https://divainparfums.mx/aviso-de-privacidad",
      termsUrl: "https://divainparfums.mx/terminos",
      cookiesUrl: "https://divainparfums.mx/cookies",
    },
    brand: {
      logoUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/166aac11-32b2-41f4-8239-0f0a5d5e6c2d.png",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
];

// ── Brand pillars (divain. PARFUMS · CARE · HOME · RITUAL) ───────────────────
// These are the 4 product lines under the unified divain. wordmark. They show up
// in lifestyle emails as a brand bar split, and the builder has a dedicated
// "brand-pillars" block that renders them with each pillar's tagline and color cue.

export type BrandPillar = {
  id: string;
  slug: string;
  label: string;            // PARFUMS, CARE, HOME, RITUAL
  tagline: string;
  bgColor: string;          // accent color shown in lifestyle composition
  imageUrl: string;         // signature product photo
};

export const BRAND_PILLARS: BrandPillar[] = [
  { id: "pl_1", slug: "parfums", label: "PARFUMS", tagline: "Fragancias de equivalencia · 100ml",      bgColor: "#E8E2D9", imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600" },
  { id: "pl_2", slug: "care",    label: "CARE",    tagline: "Cuidado facial · concentrados activos",   bgColor: "#C3E0E4", imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600" },
  { id: "pl_3", slug: "home",    label: "HOME",    tagline: "Fragancia de hogar · mikados y velas",    bgColor: "#D8DDD0", imageUrl: "https://images.unsplash.com/photo-1602874801006-e26c4ed0bb2c?w=600" },
  { id: "pl_4", slug: "ritual",  label: "RITUAL",  tagline: "Cuidado corporal · cuerpo y manos",        bgColor: "#9DBFA0", imageUrl: "https://images.unsplash.com/photo-1605651377861-348620a3faae?w=600" },
];

export type MockSender = {
  id: string;
  storeId: string;
  fromName: string;
  fromEmail: string;
  provider: "SES" | "GMAIL";
  verified: boolean;
  dailyCap: number;
  reputation: number; // 0..1
};

export const SENDERS: MockSender[] = [
  { id: "sn_1", storeId: "st_1", fromName: "divain",            fromEmail: "divain@divainparfums.com",      provider: "SES",   verified: true,  dailyCap: 700_000, reputation: 0.97 },
  { id: "sn_2", storeId: "st_2", fromName: "divain UK",         fromEmail: "hello@divainparfums.co.uk",     provider: "SES",   verified: true,  dailyCap: 300_000, reputation: 0.95 },
  { id: "sn_3", storeId: "st_3", fromName: "divain US",         fromEmail: "help@divainparfums.co",         provider: "SES",   verified: true,  dailyCap: 400_000, reputation: 0.93 },
  { id: "sn_4", storeId: "st_4", fromName: "divain México",     fromEmail: "hola@divainparfums.mx",         provider: "SES",   verified: false, dailyCap: 200_000, reputation: 0.0 },
];

export type MockCampaign = {
  id: string;
  storeId: string;
  name: string;
  subject: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
  scheduledFor: string;
  audience: number;
  languages: number;
  estimatedCost: number;
  openRate?: number;
  ctr?: number;
  revenue?: number;
  draftSource?: "MANUAL" | "AUTO_PROMOTION" | "AUTO_FLOW_BRANCH" | "AUTO_LLM" | "EXTERNAL_API";
  draftReason?: string;
  promotionId?: string;
};

export const CAMPAIGNS: MockCampaign[] = [
  { id: "cp_1", storeId: "st_1", name: "Día de la Madre — Europa",      subject: "Para ella, perfume a 11,99€",               status: "PENDING_APPROVAL", scheduledFor: "2026-05-01T08:00:00Z", audience: 421_410, languages: 21, estimatedCost: 56.10, draftSource: "AUTO_PROMOTION", draftReason: "Día de la Madre · auto-drafted 14 days before send · 21 languages", promotionId: "pm_1" },
  { id: "cp_2", storeId: "st_2", name: "Mother's Day — UK",              subject: "For her, a fragrance at £11.99",            status: "PENDING_APPROVAL", scheduledFor: "2026-03-10T08:00:00Z", audience:  82_100, languages: 1,  estimatedCost:  9.80, draftSource: "AUTO_PROMOTION", draftReason: "Mother's Day UK · auto-drafted 14 days before send", promotionId: "pm_1" },
  { id: "cp_3", storeId: "st_3", name: "Mother's Day — USA + Canada",    subject: "The fragrance she'll actually wear",        status: "APPROVED",         scheduledFor: "2026-05-10T08:00:00Z", audience: 121_800, languages: 2,  estimatedCost: 14.50, draftSource: "AUTO_PROMOTION", promotionId: "pm_1" },
  { id: "cp_4", storeId: "st_4", name: "Día de las Madres — México",     subject: "Para ella, lo que sí va a usar",             status: "APPROVED",         scheduledFor: "2026-05-10T08:00:00Z", audience:  64_440, languages: 1,  estimatedCost:  7.40, draftSource: "AUTO_PROMOTION", promotionId: "pm_1" },
  { id: "cp_5", storeId: "st_1", name: "Restock — Top 20 fragancias",    subject: "Vuelven a estar disponibles",               status: "SCHEDULED",        scheduledFor: "2026-05-14T10:00:00Z", audience: 142_320, languages: 1,  estimatedCost: 16.20, draftSource: "MANUAL" },
  { id: "cp_6", storeId: "st_1", name: "Spring Drop — Pan-EU",           subject: "Nueva colección · sólo 48h",                status: "DRAFT",            scheduledFor: "2026-05-18T09:00:00Z", audience: 380_000, languages: 21, estimatedCost: 52.80, draftSource: "AUTO_LLM", draftReason: "Generated with AI from brief: \"spring fresh florals · top sellers + 3 new releases\"" },
  { id: "cp_7", storeId: "st_1", name: "Win-back — 90 días sin compra",  subject: "Te echamos de menos. -15% solo hoy.",        status: "SENT",             scheduledFor: "2026-05-08T07:00:00Z", audience:  84_120, languages: 6,  estimatedCost: 12.20, openRate: 0.412, ctr: 0.084, revenue: 28_440 },
  { id: "cp_8", storeId: "st_1", name: "Lanzamiento divain. RITUAL",     subject: "Lumen Body Oil · presentación exclusiva",   status: "SENT",             scheduledFor: "2026-05-06T08:00:00Z", audience:  61_800, languages: 6,  estimatedCost:  8.50, openRate: 0.385, ctr: 0.061, revenue:  9_120 },
  { id: "cp_9", storeId: "st_2", name: "VIP early access — UK",          subject: "First look · 24h before everyone else",     status: "SENT",             scheduledFor: "2026-05-04T07:00:00Z", audience:   8_400, languages: 1,  estimatedCost:  0.95, openRate: 0.486, ctr: 0.132, revenue: 11_240 },
];

export type MockPromotion = {
  id: string;
  name: string;
  kind: "GLOBAL" | "REGIONAL" | "STORE";
  dateByCountry: Record<string, string>;
  emoji: string;
};

export const PROMOTIONS: MockPromotion[] = [
  { id: "pm_1", name: "Día de la Madre",        kind: "REGIONAL", emoji: "🌸", dateByCountry: { ES: "2026-05-03", MX: "2026-05-10", FR: "2026-05-25", BE: "2026-05-10", IT: "2026-05-10", PT: "2026-05-03", DE: "2026-05-10", GB: "2026-03-30", US: "2026-05-10" } },
  { id: "pm_2", name: "Día del Padre",          kind: "REGIONAL", emoji: "👔", dateByCountry: { ES: "2026-03-19", IT: "2026-03-19", PT: "2026-03-19", FR: "2026-06-21", DE: "2026-05-29", GB: "2026-06-21", US: "2026-06-21" } },
  { id: "pm_3", name: "San Valentín",           kind: "GLOBAL",   emoji: "❤️", dateByCountry: { ES: "2026-02-14", FR: "2026-02-14", IT: "2026-02-14", DE: "2026-02-14", GB: "2026-02-14", US: "2026-02-14" } },
  { id: "pm_4", name: "Black Friday",            kind: "GLOBAL",   emoji: "🛍️", dateByCountry: { ES: "2026-11-27", FR: "2026-11-27", IT: "2026-11-27", DE: "2026-11-27", GB: "2026-11-27", US: "2026-11-27" } },
  { id: "pm_5", name: "Cyber Monday",           kind: "GLOBAL",   emoji: "💻", dateByCountry: { ES: "2026-11-30", FR: "2026-11-30", IT: "2026-11-30", DE: "2026-11-30", GB: "2026-11-30", US: "2026-11-30" } },
  { id: "pm_6", name: "Aniversario Divain",     kind: "STORE",    emoji: "🎉", dateByCountry: { ES: "2026-06-12" } },
  { id: "pm_7", name: "Día Internacional Mujer",kind: "GLOBAL",   emoji: "🌷", dateByCountry: { ES: "2026-03-08", FR: "2026-03-08", IT: "2026-03-08", DE: "2026-03-08", GB: "2026-03-08", US: "2026-03-08" } },
  { id: "pm_8", name: "Verano · Summer Drop",   kind: "GLOBAL",   emoji: "☀️", dateByCountry: { ES: "2026-06-21", FR: "2026-06-21", IT: "2026-06-21", DE: "2026-06-21", GB: "2026-06-21", US: "2026-06-21" } },
  { id: "pm_9", name: "Vuelta al cole",         kind: "REGIONAL", emoji: "🎒", dateByCountry: { ES: "2026-09-08", FR: "2026-09-01", IT: "2026-09-15", DE: "2026-08-20", GB: "2026-09-03", US: "2026-08-25" } },
];

export type MockSegment = {
  id: string;
  storeId: string;
  name: string;
  size: number;
  description: string;
};

export const SEGMENTS: MockSegment[] = [
  { id: "sg_1",  storeId: "st_1", name: "VIP Europa (>250€ / 12m)",   size: 28_420, description: "Customers who spent over €250 in the last 12 months across Europa" },
  { id: "sg_2",  storeId: "st_1", name: "Riesgo de churn · Europa",   size: 42_180, description: "Subscribed, last purchase 60–120 days ago, no email open in 30d" },
  { id: "sg_3",  storeId: "st_1", name: "Nuevos sin 2ª compra",       size: 18_840, description: "1 order, last 90 days, no repeat purchase" },
  { id: "sg_4",  storeId: "st_1", name: "FR · actifs été",            size: 48_120, description: "France subscribers, opened ≥1 campaign in last 30d" },
  { id: "sg_5",  storeId: "st_2", name: "UK VIP",                     size:  4_220, description: "Top 5% by spend in UK store" },
  { id: "sg_6",  storeId: "st_3", name: "USA · Hispanic",             size: 22_400, description: "USA customers with Spanish preference — receive es-MX content" },
  { id: "sg_7",  storeId: "st_4", name: "México VIP",                 size:  3_840, description: "Top 5% by spend in Mexico store" },
  { id: "sg_8",  storeId: "st_1", name: "Cart abandoners 24h",        size:    980, description: "Abandoned checkout in last 24h, value > €30, no subsequent order" },
  { id: "sg_9",  storeId: "st_1", name: "App users · push reached",   size:114_200, description: "Has app installed, push delivered in last 24h — excluded from email" },
  { id: "sg_10", storeId: "st_1", name: "Care · primera compra",      size: 18_900, description: "First purchase in divain. CARE pillar in last 30d" },
  { id: "sg_11", storeId: "st_1", name: "Ritual · cross-sell candidates", size: 31_200, description: "Bought parfums, never bought ritual — eligible for cross-sell" },
];

// Time-series mock for the dashboard charts (last 30 days)
export function makeSendTrend() {
  const out: { day: string; sent: number; delivered: number; opened: number; revenue: number }[] = [];
  const base = new Date("2026-05-12T00:00:00Z").getTime();
  let drift = 580_000;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base - i * 86_400_000);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    drift += (Math.sin(i / 3.1) * 28_000) | 0;
    const sent = Math.max(120_000, drift + (weekend ? -180_000 : 0));
    const delivered = Math.round(sent * (0.985 + Math.sin(i) * 0.005));
    const opened = Math.round(delivered * (0.32 + Math.cos(i / 5) * 0.04));
    const revenue = Math.round(opened * (0.35 + Math.sin(i / 7) * 0.08));
    out.push({
      day: d.toISOString().slice(5, 10),
      sent,
      delivered,
      opened,
      revenue,
    });
  }
  return out;
}

export function makeCostBreakdown() {
  return [
    { name: "SES",      value: 2014.32, color: "var(--chart-1)" },
    { name: "DeepL",    value: 342.10,  color: "var(--chart-2)" },
    { name: "Gemini",   value: 188.40,  color: "var(--chart-3)" },
    { name: "AWS",      value: 412.00,  color: "var(--chart-4)" },
    { name: "Google",   value:  98.00,  color: "var(--chart-5)" },
  ];
}

export function makeLanguageShare() {
  return [
    { language: "es-ES", pct: 0.34 },
    { language: "fr-FR", pct: 0.18 },
    { language: "it-IT", pct: 0.11 },
    { language: "de-DE", pct: 0.09 },
    { language: "en-GB", pct: 0.08 },
    { language: "pt-PT", pct: 0.06 },
    { language: "nl-NL", pct: 0.04 },
    { language: "pl-PL", pct: 0.03 },
    { language: "other", pct: 0.07 },
  ];
}

export type MockCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  storeId: string;
  country: string;
  language: string;
  totalSpent: number;
  ordersCount: number;
  hasApp: boolean;
  consentStatus: "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING" | "BOUNCED";
  lastSeen: string;
};

const FIRST = ["Lucía", "Carmen", "Sofía", "María", "Paula", "Marta", "Alba", "Laura", "Elena", "Sara", "Anaïs", "Camille", "Chloé", "Léa", "Manon", "Sophia", "Giulia", "Martina", "Emma", "Greta", "Mia", "Lena", "Hannah", "Lara", "Olivia", "Amelia", "Charlotte", "Isabella"];
const LAST = ["García", "Martínez", "Rodríguez", "López", "Pérez", "Sánchez", "Romero", "Torres", "Dubois", "Lefèvre", "Moreau", "Bianchi", "Romano", "Ricci", "Müller", "Schmidt", "Weber", "Fischer", "Smith", "Brown", "Wilson", "Taylor"];
const STORE_IDS = STORES.map((s) => s.id);

export function makeCustomers(n = 100): MockCustomer[] {
  const out: MockCustomer[] = [];
  for (let i = 0; i < n; i++) {
    const f = FIRST[(i * 7) % FIRST.length];
    const l = LAST[(i * 11) % LAST.length];
    const storeId = STORE_IDS[i % STORE_IDS.length];
    const store = STORES.find((s) => s.id === storeId)!;
    const lang = LANGUAGES[(i * 3) % LANGUAGES.length];
    const orders = (i * 13) % 17;
    const spent = orders * (28 + ((i * 7) % 90));
    const consent =
      i % 23 === 0 ? "BOUNCED" :
      i % 17 === 0 ? "UNSUBSCRIBED" :
      i % 19 === 0 ? "PENDING" : "SUBSCRIBED";
    out.push({
      id: `cu_${i + 1}`,
      email: `${f.toLowerCase().replace(/[^a-z]/g, "")}.${l.toLowerCase().replace(/[^a-z]/g, "")}${i}@example.com`,
      firstName: f,
      lastName: l,
      storeId,
      country: store.countryCode,
      language: lang.code,
      totalSpent: spent,
      ordersCount: orders,
      hasApp: i % 4 === 0,
      consentStatus: consent as MockCustomer["consentStatus"],
      lastSeen: new Date(Date.now() - ((i * 13_000_000) % (90 * 86_400_000))).toISOString(),
    });
  }
  return out;
}

export const FLOWS = [
  { id: "fl_1", storeId: "st_1", name: "Bienvenida nueva suscripción",       trigger: "WELCOME",             active: true,  enrolled: 1_240,  conversionRate: 0.092, revenue30d: 38_220 },
  { id: "fl_2", storeId: "st_1", name: "Carrito abandonado 1h / 24h / 48h",  trigger: "ABANDONED_CART",       active: true,  enrolled: 4_810,  conversionRate: 0.184, revenue30d: 92_410 },
  { id: "fl_3", storeId: "st_1", name: "Post-compra · review + cross-sell",  trigger: "POST_PURCHASE",        active: true,  enrolled: 3_120,  conversionRate: 0.071, revenue30d: 22_080 },
  { id: "fl_4", storeId: "st_1", name: "Win-back 60 / 90 / 120 días",        trigger: "WIN_BACK",             active: true,  enrolled: 8_400,  conversionRate: 0.044, revenue30d: 31_840 },
  { id: "fl_5", storeId: "st_2", name: "Browse abandonment",                  trigger: "BROWSE_ABANDONMENT",   active: false, enrolled:     0,  conversionRate: 0,     revenue30d:      0 },
  { id: "fl_6", storeId: "st_1", name: "Restock — favoritos del cliente",    trigger: "RESTOCK",              active: true,  enrolled: 2_140,  conversionRate: 0.218, revenue30d: 41_010 },
  { id: "fl_7", storeId: "st_4", name: "Cumpleaños · descuento personal",    trigger: "BIRTHDAY",             active: true,  enrolled:   320,  conversionRate: 0.243, revenue30d:  8_640 },
];

export const APPROVALS_INBOX = CAMPAIGNS.filter((c) => c.status === "PENDING_APPROVAL");

// ── Discount codes ───────────────────────────────────────────────────────────

export type MockDiscount = {
  id: string;
  code: string;
  storeId: string;
  kind: "PERCENT" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  customerEmail?: string;        // bound (one-shot) vs null (shareable)
  usedCount: number;
  usageLimit: number;
  startsAt: string;
  endsAt?: string;
  source: "manual" | "flow:abandoned-cart" | "flow:win-back" | "flow:birthday" | "campaign";
  campaignId?: string;
  appliesTo?: string;            // product/collection handle
};

export const DISCOUNTS: MockDiscount[] = [
  { id: "dc_1", code: "VUELVE-7K2P9X", storeId: "st_1", kind: "PERCENT",     value: 15, customerEmail: "lucia.garcia0@example.com", usedCount: 0, usageLimit: 1, startsAt: "2026-05-12T00:00:00Z", endsAt: "2026-05-15T23:59:59Z", source: "flow:abandoned-cart" },
  { id: "dc_2", code: "VUELVE-K3M2QA", storeId: "st_1", kind: "PERCENT",     value: 15, customerEmail: "carmen.martinez7@example.com", usedCount: 1, usageLimit: 1, startsAt: "2026-05-10T00:00:00Z", endsAt: "2026-05-13T23:59:59Z", source: "flow:abandoned-cart" },
  { id: "dc_3", code: "FELIZ24",       storeId: "st_1", kind: "PERCENT",     value: 20, usedCount: 1820, usageLimit: 10_000, startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-05-31T23:59:59Z", source: "manual" },
  { id: "dc_4", code: "PADRE-X92K1A",  storeId: "st_1", kind: "FIXED_AMOUNT",value:  5, customerEmail: "sofia.romero3@example.com", usedCount: 0, usageLimit: 1, startsAt: "2026-06-15T00:00:00Z", endsAt: "2026-06-22T23:59:59Z", source: "flow:birthday" },
  { id: "dc_5", code: "ENVIO-GRATIS",  storeId: "st_1", kind: "FREE_SHIPPING",value: 0, usedCount:  412, usageLimit:  5_000, startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-06-30T23:59:59Z", source: "manual" },
  { id: "dc_6", code: "BACK-A7K2J9X",  storeId: "st_1", kind: "PERCENT",     value: 10, customerEmail: "lea.dubois9@example.com", usedCount: 0, usageLimit: 1, startsAt: "2026-05-11T00:00:00Z", endsAt: "2026-05-18T23:59:59Z", source: "flow:win-back" },
  { id: "dc_7", code: "VIP-UK-22",     storeId: "st_2", kind: "PERCENT",     value: 25, usedCount:   84, usageLimit:    500, startsAt: "2026-05-04T00:00:00Z", endsAt: "2026-05-31T23:59:59Z", source: "manual" },
  { id: "dc_8", code: "WELCOME-US",    storeId: "st_3", kind: "PERCENT",     value: 15, usedCount: 1380, usageLimit: 10_000, startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-12-31T23:59:59Z", source: "manual" },
  { id: "dc_9", code: "BIENVENIDA-MX", storeId: "st_4", kind: "PERCENT",     value: 15, usedCount:  680, usageLimit:  5_000, startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-12-31T23:59:59Z", source: "manual" },
];

// ── Suppressions ─────────────────────────────────────────────────────────────

export type MockSuppression = {
  id: string;
  email: string;
  reason: "BOUNCE_HARD" | "COMPLAINT" | "UNSUBSCRIBE" | "MANUAL";
  source: string;
  createdAt: string;
};

export const SUPPRESSIONS: MockSuppression[] = [
  { id: "sp_1",  email: "wrong.address+wrong@invalid.tld",     reason: "BOUNCE_HARD", source: "ses:bounce",        createdAt: "2026-05-11T08:21:00Z" },
  { id: "sp_2",  email: "marketing-spam-report@example.com",   reason: "COMPLAINT",   source: "ses:complaint",     createdAt: "2026-05-10T16:45:00Z" },
  { id: "sp_3",  email: "no-more-emails@example.com",          reason: "UNSUBSCRIBE", source: "user:click-unsub",  createdAt: "2026-05-10T12:08:00Z" },
  { id: "sp_4",  email: "old@deleted-domain.fr",               reason: "BOUNCE_HARD", source: "ses:bounce",        createdAt: "2026-05-09T22:14:00Z" },
  { id: "sp_5",  email: "left.the.company@oldjob.com",         reason: "BOUNCE_HARD", source: "ses:bounce",        createdAt: "2026-05-09T18:02:00Z" },
  { id: "sp_6",  email: "unsubbed@example.com",                reason: "UNSUBSCRIBE", source: "preference-center", createdAt: "2026-05-09T11:30:00Z" },
  { id: "sp_7",  email: "fakelead@signupform.com",             reason: "BOUNCE_HARD", source: "ses:bounce",        createdAt: "2026-05-08T07:56:00Z" },
  { id: "sp_8",  email: "manual-add@divainparfums.com",        reason: "MANUAL",      source: "admin:faun",        createdAt: "2026-05-07T15:22:00Z" },
  { id: "sp_9",  email: "complained.again@example.com",        reason: "COMPLAINT",   source: "ses:complaint",     createdAt: "2026-05-07T09:18:00Z" },
  { id: "sp_10", email: "moved-on@example.it",                 reason: "UNSUBSCRIBE", source: "user:click-unsub",  createdAt: "2026-05-06T14:11:00Z" },
];

// ── Product catalog ──────────────────────────────────────────────────────────
// Divain perfume equivalencia — codes like "DIVAIN-103" are placeholders that
// reference an "equivalencia de" (smells-like-X) flagship fragrance.

export type MockProduct = {
  id: string;
  storeId: string;
  shopifyId: string;
  handle: string;
  title: string;
  description: string;
  imageUrl: string;
  pillar: "parfums" | "care" | "home" | "ritual";  // which brand pillar this product belongs to
  inspiredBy: string;     // "smells like" reference (parfums) or product role (others)
  family: string;         // oriental/woody/floral/fresh for parfums · serum/cream/oil/mask for care · etc.
  gender: "men" | "women" | "unisex";
  inventoryQty: number;
  prices: Record<string, { currency: string; price: number; compareAt?: number }>; // by market code
};

const PROD_IMG = [
  "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600",
  "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600",
  "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600",
  "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600",
  "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=600",
  "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=600",
  "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600",
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600",
  "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600",
  "https://images.unsplash.com/photo-1605651377861-348620a3faae?w=600",
];

const PERFUMES: { code: string; inspiredBy: string; family: MockProduct["family"]; gender: MockProduct["gender"] }[] = [
  { code: "DIVAIN-103", inspiredBy: "Sauvage · Dior",                family: "fresh",    gender: "men"   },
  { code: "DIVAIN-215", inspiredBy: "La Vie est Belle · Lancôme",    family: "floral",   gender: "women" },
  { code: "DIVAIN-073", inspiredBy: "Black Opium · YSL",             family: "oriental", gender: "women" },
  { code: "DIVAIN-191", inspiredBy: "Acqua di Giò · Armani",         family: "fresh",    gender: "men"   },
  { code: "DIVAIN-022", inspiredBy: "J'adore · Dior",                family: "floral",   gender: "women" },
  { code: "DIVAIN-345", inspiredBy: "Tom Ford Tobacco Vanille",      family: "oriental", gender: "unisex" },
  { code: "DIVAIN-118", inspiredBy: "Coco Mademoiselle · Chanel",    family: "floral",   gender: "women" },
  { code: "DIVAIN-540", inspiredBy: "Baccarat Rouge 540 · MFK",      family: "oriental", gender: "unisex" },
  { code: "DIVAIN-008", inspiredBy: "Bleu de Chanel · Chanel",       family: "woody",    gender: "men"   },
  { code: "DIVAIN-220", inspiredBy: "Si · Armani",                   family: "floral",   gender: "women" },
  { code: "DIVAIN-307", inspiredBy: "Oud Wood · Tom Ford",           family: "woody",    gender: "unisex" },
  { code: "DIVAIN-411", inspiredBy: "Light Blue · D&G",              family: "fresh",    gender: "women" },
];

// Same SKU sold across markets with country-specific pricing.
// Reflects VAT differences, market positioning, and currency conversion.
function pricesByMarket(base: number): MockProduct["prices"] {
  // .99 ending for psychological pricing
  const eu = (offset = 0) => Math.round((base + offset) * 100) / 100 - 0.01;
  const gbp = Math.round((base + 1) * 0.86 * 100) / 100 - 0.01;
  const usd = Math.round((base + 1) * 1.08 * 100) / 100 - 0.01;
  const cad = Math.round((base + 2) * 1.48 * 100) / 100 - 0.01;
  // MXN: round to nearest 10
  const mxn = Math.round((base + 1) * 21 / 10) * 10 - 1;
  return {
    // EU markets
    ES: { currency: "EUR", price: eu(),     compareAt: eu() + 8 },
    PT: { currency: "EUR", price: eu(),     compareAt: eu() + 8 },
    AD: { currency: "EUR", price: eu(),     compareAt: eu() + 8 },
    FR: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    BE: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    DE: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    IT: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    NL: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    AT: { currency: "EUR", price: eu(2),    compareAt: eu() + 8 },
    LU: { currency: "EUR", price: eu(2),    compareAt: eu() + 8 },
    IE: { currency: "EUR", price: eu(2),    compareAt: eu() + 8 },
    CH: { currency: "EUR", price: eu(2),    compareAt: eu() + 8 },
    PL: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    SE: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    DK: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    FI: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    NO: { currency: "EUR", price: eu(1.5),  compareAt: eu() + 8 },
    CZ: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    RO: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    HU: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    BG: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    SK: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    SI: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    GR: { currency: "EUR", price: eu(0.5),  compareAt: eu() + 8 },
    // Anglo
    GB: { currency: "GBP", price: gbp,      compareAt: Math.round((base + 8) * 0.86 * 100) / 100 },
    // North America
    US: { currency: "USD", price: usd,      compareAt: Math.round((base + 8) * 1.08 * 100) / 100 },
    CA: { currency: "CAD", price: cad,      compareAt: Math.round((base + 8) * 1.48 * 100) / 100 },
    // LatAm
    MX: { currency: "MXN", price: mxn,      compareAt: Math.round((base + 8) * 21 / 10) * 10 - 1 },
  };
}

export const PRODUCTS: MockProduct[] = PERFUMES.flatMap((p, i) => {
  // Parfums sell in every geographic store (the flagship pillar)
  const stores = ["st_1", "st_2", "st_3", "st_4"];
  const base = 13.99 + ((i * 1.1) % 6);
  return stores.map((sid, j) => ({
    id: `pr_p${i + 1}_${sid}`,
    storeId: sid,
    shopifyId: `gid://shopify/Product/${10000 + i * 4 + j}`,
    handle: p.code.toLowerCase(),
    title: `${p.code} — equivalencia de ${p.inspiredBy}`,
    description: `Fragancia de la familia ${p.family}. Perfil ${p.gender === "unisex" ? "unisex" : p.gender === "men" ? "masculino" : "femenino"}. 100ml. Larga duración.`,
    imageUrl: PROD_IMG[i % PROD_IMG.length],
    pillar: "parfums" as const,
    inspiredBy: p.inspiredBy,
    family: p.family,
    gender: p.gender,
    inventoryQty: 200 + ((i * 47 + j * 11) % 800),
    prices: pricesByMarket(base),
  }));
});

// ── divain. CARE (skincare) ──
const CARE_ITEMS = [
  { code: "CARE-VITAL",    title: "Vital Booster Serum · 30ml",      family: "serum",     price: 24.90, img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600" },
  { code: "CARE-RETINOL",  title: "Retinol Night Concentrate · 30ml", family: "treatment", price: 28.50, img: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=600" },
  { code: "CARE-CICA",     title: "Cica Repair Cream · 50ml",         family: "cream",     price: 19.90, img: "https://images.unsplash.com/photo-1605651377861-348620a3faae?w=600" },
  { code: "CARE-VITAMIN",  title: "Vitamin C Glow Serum · 30ml",      family: "serum",     price: 22.00, img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600" },
  { code: "CARE-MASK",     title: "Mascarilla Hidratante 24h",        family: "mask",      price: 14.90, img: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=600" },
];

// ── divain. HOME (home fragrance) ──
const HOME_ITEMS = [
  { code: "HOME-GREENDAO", title: "Green Dao · Mikado 80ml",          family: "diffuser",  price: 24.00, img: "https://images.unsplash.com/photo-1602874801006-e26c4ed0bb2c?w=600" },
  { code: "HOME-OUDWOOD",  title: "Oud & Wood · Vela 200g",           family: "candle",    price: 18.50, img: "https://images.unsplash.com/photo-1602874801006-e26c4ed0bb2c?w=600" },
  { code: "HOME-CITRUS",   title: "Citrus Garden · Mikado 100ml",     family: "diffuser",  price: 19.90, img: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600" },
];

// ── divain. RITUAL (body care) ──
const RITUAL_ITEMS = [
  { code: "RITUAL-LUMEN",  title: "Lumen Grapefruit & Lemongrass Body Oil · 100ml", family: "oil",   price: 19.50, img: "https://images.unsplash.com/photo-1605651377861-348620a3faae?w=600" },
  { code: "RITUAL-WASH",   title: "Body Wash Sándalo · 250ml",         family: "wash",     price: 14.00, img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600" },
  { code: "RITUAL-HAND",   title: "Hand Cream Rosa & Karité · 75ml",   family: "cream",    price:  9.90, img: "https://images.unsplash.com/photo-1605651377861-348620a3faae?w=600" },
];

// Each non-parfums product sells across all 4 stores too (same SKU, per-market pricing).
function addLine(items: typeof CARE_ITEMS, pillar: "care" | "home" | "ritual", prefix: string) {
  for (const [i, item] of items.entries()) {
    for (const [j, sid] of ["st_1", "st_2", "st_3", "st_4"].entries()) {
      PRODUCTS.push({
        id: `pr_${prefix}${i + 1}_${sid}`,
        storeId: sid,
        shopifyId: `gid://shopify/Product/${90000 + (pillar === "care" ? 0 : pillar === "home" ? 100 : 200) + i * 4 + j}`,
        handle: item.code.toLowerCase(),
        title: item.title,
        description: `divain. ${pillar.toUpperCase()} · ${item.family}.`,
        imageUrl: item.img,
        pillar,
        inspiredBy: "—",
        family: item.family,
        gender: "unisex",
        inventoryQty: 80 + i * 30 + j * 7,
        prices: pricesByMarket(item.price),
      });
    }
  }
}
addLine(CARE_ITEMS,   "care",   "c");
addLine(HOME_ITEMS,   "home",   "h");
addLine(RITUAL_ITEMS, "ritual", "r");

export const ASSETS = [
  { id: "as_1",  name: "hero-summer-2026.jpg",         kind: "IMAGE",            tags: ["hero", "summer", "fragrance"],       prompt: null,                                                       generatedBy: "manual",                  url: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800" },
  { id: "as_2",  name: "mothers-day-banner-es.png",    kind: "BANNER_GENERATED", tags: ["mothers-day", "es", "banner"],        prompt: "Elegant mother's day banner, warm gold tones, perfume bottles, hand-drawn flowers", generatedBy: "gemini-2.5-flash-image", url: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800" },
  { id: "as_3",  name: "product-divain-103-pdp.jpg",   kind: "PRODUCT_PHOTO",    tags: ["product", "divain-103"],              prompt: null,                                                       generatedBy: "manual",                  url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800" },
  { id: "as_4",  name: "valentines-2026-loop.gif",     kind: "GIF",              tags: ["valentines", "love", "animation"],    prompt: null,                                                       generatedBy: "manual",                  url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800" },
  { id: "as_5",  name: "logo-divain-light.svg",        kind: "LOGO",             tags: ["logo", "brand"],                      prompt: null,                                                       generatedBy: "manual",                  url: "https://images.unsplash.com/photo-1532009324734-20a7a5813719?w=800" },
  { id: "as_6",  name: "banner-fathers-day-it.png",    kind: "BANNER_GENERATED", tags: ["fathers-day", "it"],                  prompt: "Italian father's day, woody luxury fragrance bottles, deep navy and amber palette", generatedBy: "gemini-2.5-flash-image", url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800" },
  { id: "as_7",  name: "summer-drop-2026.jpg",         kind: "IMAGE",            tags: ["summer", "drop"],                     prompt: null,                                                       generatedBy: "manual",                  url: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=800" },
  { id: "as_8",  name: "vip-early-access-uk.png",      kind: "BANNER_GENERATED", tags: ["vip", "uk"],                          prompt: "VIP early access banner, gold foil texture, minimal luxury",                          generatedBy: "gemini-2.5-flash-image", url: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800" },
];
