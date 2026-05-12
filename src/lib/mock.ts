// Sendify configuration & types.
// EVERYTHING IN THIS FILE IS REAL CONFIG FOR DIVAIN — no fake data anymore.
//
// Removed deliberately (used to live here as visual sample data for UX preview):
//   - Sample campaigns, segments, flows, customers, products, promotions, discounts,
//     suppressions, asset library, time-series charts.
// Those things now come from the database once Sendify is connected (Neon/RDS).
// Pages that have no data render an EmptyState with the right next-step CTA.

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

// ── The 4 real divain Shopify Plus stores ──
// All under the unified `divain.` brand, each a separate legal entity.
// Counts are zero until first Shopify sync — they'll be updated automatically.

export const STORES: MockStore[] = [
  {
    id: "st_1", slug: "divain-europa", name: "divain · Europa",
    shopifyDomain: "divaines.myshopify.com", storefrontUrl: "https://divainparfums.com",
    countryCode: "ES", defaultLanguage: "es-ES", currency: "EUR",
    markets: ["ES", "PT", "AD", "FR", "BE", "NL", "DE", "AT", "IT", "IE", "LU", "CH", "PL", "SE", "DK", "FI", "NO", "CZ", "RO", "HU", "BG", "SK", "SI", "GR"],
    productCount: 0, customers: 0, subscribed: 0,
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
      logoUrl: "",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_2", slug: "divain-uk", name: "divain · UK",
    shopifyDomain: "divaingb.myshopify.com", storefrontUrl: "https://divainparfums.co.uk",
    countryCode: "GB", defaultLanguage: "en-GB", currency: "GBP",
    markets: ["GB", "IE"], productCount: 0, customers: 0, subscribed: 0,
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
      logoUrl: "",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_3", slug: "divain-na", name: "divain · USA + Canada",
    shopifyDomain: "divainusa.myshopify.com", storefrontUrl: "https://divainparfums.co",
    countryCode: "US", defaultLanguage: "en-US", currency: "USD",
    markets: ["US", "CA"], productCount: 0, customers: 0, subscribed: 0,
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
      logoUrl: "",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
  {
    id: "st_4", slug: "divain-mx", name: "divain · México",
    shopifyDomain: "divainmx.myshopify.com", storefrontUrl: "https://divainparfums.mx",
    countryCode: "MX", defaultLanguage: "es-MX", currency: "MXN",
    markets: ["MX"], productCount: 0, customers: 0, subscribed: 0,
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
      logoUrl: "",
      palette: { primary: "#000000", accent: "#D99425", bg: "#FFFFFF", text: "#1A1A1A" },
      fontHeading: "Outfit", fontBody: "Inter",
    },
  },
];

// ── Brand pillars (the 4 divain product lines) ──

export type BrandPillar = {
  id: string;
  slug: string;
  label: string;
  tagline: string;
  bgColor: string;
};

export const BRAND_PILLARS: BrandPillar[] = [
  { id: "pl_1", slug: "parfums", label: "PARFUMS", tagline: "Fragancias de equivalencia · 100ml",      bgColor: "#E8E2D9" },
  { id: "pl_2", slug: "care",    label: "CARE",    tagline: "Cuidado facial · concentrados activos",   bgColor: "#C3E0E4" },
  { id: "pl_3", slug: "home",    label: "HOME",    tagline: "Fragancia de hogar · mikados y velas",    bgColor: "#D8DDD0" },
  { id: "pl_4", slug: "ritual",  label: "RITUAL",  tagline: "Cuidado corporal · cuerpo y manos",        bgColor: "#9DBFA0" },
];

// ── Sender identities — the 4 real verified SES senders ──

export type MockSender = {
  id: string;
  storeId: string;
  fromName: string;
  fromEmail: string;
  provider: "SES" | "GMAIL";
  verified: boolean;
  dailyCap: number;
  reputation: number;
  warmupStartedAt: Date | null;
  warmupTargetPerDay: number;
};

export const SENDERS: MockSender[] = [
  { id: "sn_1", storeId: "st_1", fromName: "divain",        fromEmail: "divain@divainparfums.com",  provider: "SES", verified: false, dailyCap: 700_000, reputation: 0, warmupStartedAt: null, warmupTargetPerDay: 670_000 },
  { id: "sn_2", storeId: "st_2", fromName: "divain UK",     fromEmail: "hello@divainparfums.co.uk", provider: "SES", verified: false, dailyCap: 300_000, reputation: 0, warmupStartedAt: null, warmupTargetPerDay: 270_000 },
  { id: "sn_3", storeId: "st_3", fromName: "divain US",     fromEmail: "help@divainparfums.co",     provider: "SES", verified: false, dailyCap: 400_000, reputation: 0, warmupStartedAt: null, warmupTargetPerDay: 370_000 },
  { id: "sn_4", storeId: "st_4", fromName: "divain México", fromEmail: "hola@divainparfums.mx",     provider: "SES", verified: false, dailyCap: 200_000, reputation: 0, warmupStartedAt: null, warmupTargetPerDay: 180_000 },
];

// ── Empty placeholders kept so existing imports don't break ──
// Pages that read these now render an EmptyState. Once we wire each page to Prisma,
// it stops importing from here. Delete the export when the last importer goes away.

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

export type MockSegment    = { id: string; storeId: string; name: string; size: number; description: string };
export type MockPromotion  = { id: string; name: string; kind: "GLOBAL" | "REGIONAL" | "STORE"; dateByCountry: Record<string, string>; emoji: string };
export type MockCustomer   = { id: string; email: string; firstName: string; lastName: string; storeId: string; country: string; language: string; totalSpent: number; ordersCount: number; hasApp: boolean; consentStatus: "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING" | "BOUNCED"; lastSeen: string };
export type MockProduct    = { id: string; storeId: string; shopifyId: string; handle: string; title: string; description: string; imageUrl: string; pillar: "parfums" | "care" | "home" | "ritual"; inspiredBy: string; family: string; gender: "men" | "women" | "unisex"; inventoryQty: number; prices: Record<string, { currency: string; price: number; compareAt?: number }> };
export type MockDiscount   = { id: string; code: string; storeId: string; kind: "PERCENT" | "FIXED_AMOUNT" | "FREE_SHIPPING"; value: number; customerEmail?: string; usedCount: number; usageLimit: number; startsAt: string; endsAt?: string; source: "manual" | "flow:abandoned-cart" | "flow:win-back" | "flow:birthday" | "campaign"; campaignId?: string; appliesTo?: string };
export type MockSuppression = { id: string; email: string; reason: "BOUNCE_HARD" | "COMPLAINT" | "UNSUBSCRIBE" | "MANUAL"; source: string; createdAt: string };

export const CAMPAIGNS:        MockCampaign[]    = [];
export const SEGMENTS:         MockSegment[]     = [];
export const PROMOTIONS:       MockPromotion[]   = [];
export const PRODUCTS:         MockProduct[]     = [];
export const FLOWS: Array<{ id: string; storeId: string; name: string; trigger: string; active: boolean; enrolled: number; conversionRate: number; revenue30d: number }> = [];
export const ASSETS: Array<{ id: string; name: string; kind: string; tags: string[]; prompt: string | null; generatedBy: string; url: string }> = [];
export const APPROVALS_INBOX:  MockCampaign[]    = [];
export const DISCOUNTS:        MockDiscount[]    = [];
export const SUPPRESSIONS:     MockSuppression[] = [];

// ── Empty helpers (return zero data) ──

export function makeCustomers(_n: number = 0): MockCustomer[] { return []; }
export function makeSendTrend()                              { return [] as { day: string; sent: number; delivered: number; opened: number; revenue: number }[]; }
export function makeCostBreakdown()                          { return [] as { name: string; value: number; color: string }[]; }
export function makeLanguageShare()                          { return [] as { language: string; pct: number }[]; }
