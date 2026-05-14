// Built-in marketing calendar — the seed set of dates the auto-planner uses to
// drop draft campaigns into the approval inbox. The Promotion table is the
// source of truth at runtime; this file is just the initial seed.
//
// One entry per event. dateByCountry is the localized date (Mother's Day shifts
// by country) — the auto-planner picks the right one per store. Each entry
// has a brief that the AI generator uses to write the actual subject/preheader
// /MJML at draft time. Tone + audienceHint nudge the LLM toward the right voice
// for each kind of moment.

export type CalendarEvent = {
  slug: string;                  // stable id used as Promotion.externalId
  name: string;
  kind: "GLOBAL" | "REGIONAL" | "BRAND_OWN";
  pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL";
  dateByCountry: Record<string, string>;   // ISO date per country code
  brief: string;                  // LLM brief
  tone: string;
  leadDays: number;               // draft N days before send
  segmentHint?: string;           // free-text segment suggestion
};

// Mapping store-slug → country (used to pick the date from dateByCountry).
export const STORE_COUNTRY: Record<string, string[]> = {
  "divain-europa": ["ES", "PT", "FR", "DE", "IT", "BE", "NL"],
  "divain-uk":     ["GB", "IE"],
  "divain-na":     ["US", "CA"],
  "divain-mx":     ["MX"],
};

export const MARKETING_CALENDAR_2026: CalendarEvent[] = [
  // ── Q1 ────────────────────────────────────────────────────────────────
  {
    slug: "san-valentin-2026",
    name: "San Valentín",
    kind: "GLOBAL", pillar: "PARFUMS",
    dateByCountry: { ES: "2026-02-14", FR: "2026-02-14", DE: "2026-02-14", IT: "2026-02-14", GB: "2026-02-14", US: "2026-02-14", CA: "2026-02-14", MX: "2026-02-14" },
    brief: "San Valentín · 20% en fragancias para regalo · pack pareja con envoltorio · CTA descubrir colección amor",
    tone: "editorial-cálido", leadDays: 14,
  },
  {
    slug: "dia-internacional-mujer-2026",
    name: "Día Internacional de la Mujer",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-03-08", FR: "2026-03-08", DE: "2026-03-08", IT: "2026-03-08", GB: "2026-03-08", US: "2026-03-08", CA: "2026-03-08", MX: "2026-03-08" },
    brief: "8 de marzo · fuerza y carácter · sin descuento · editorial de las 3 fragancias más vendidas mujer · CTA leer historia",
    tone: "editorial-cálido", leadDays: 10,
  },
  {
    slug: "dia-madre-uk-2026",
    name: "Mother's Day · UK",
    kind: "REGIONAL", pillar: "PARFUMS",
    dateByCountry: { GB: "2026-03-15", IE: "2026-03-15" },
    brief: "Mother's Day UK · fragancias mujer · sense of refinement · CTA shop the edit",
    tone: "lujo-minimalista", leadDays: 14,
  },

  // ── Q2 ────────────────────────────────────────────────────────────────
  {
    slug: "dia-madre-2026",
    name: "Día de la Madre",
    kind: "REGIONAL", pillar: "PARFUMS",
    dateByCountry: { ES: "2026-05-03", PT: "2026-05-03", FR: "2026-05-25", DE: "2026-05-10", IT: "2026-05-10", US: "2026-05-10", CA: "2026-05-10", MX: "2026-05-10" },
    brief: "Día de la Madre · 15% off perfumes mujer · regalo perfecto · pack edición especial · CTA ver colección regalos",
    tone: "editorial-cálido", leadDays: 21,
  },
  {
    slug: "dia-padre-2026",
    name: "Día del Padre",
    kind: "REGIONAL", pillar: "PARFUMS",
    dateByCountry: { ES: "2026-03-19", PT: "2026-03-19", IT: "2026-03-19", GB: "2026-06-21", US: "2026-06-21", CA: "2026-06-21", MX: "2026-06-21", FR: "2026-06-21", DE: "2026-06-21" },
    brief: "Día del Padre · fragancias hombre · sofisticación atemporal · 15% off colección hombre · CTA descubrir",
    tone: "editorial-cálido", leadDays: 14,
  },

  // ── Q3 ────────────────────────────────────────────────────────────────
  {
    slug: "rebajas-verano-2026",
    name: "Rebajas de verano",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-07-01", FR: "2026-06-24", DE: "2026-07-01", IT: "2026-07-04", GB: "2026-06-26", US: "2026-07-04", CA: "2026-07-01", MX: "2026-07-01" },
    brief: "Rebajas verano · hasta -40% en selección · fragancias frescas · cítricos · CTA ver rebajas",
    tone: "comercial-directo", leadDays: 7,
  },
  {
    slug: "back-to-school-2026",
    name: "Vuelta al cole / Septiembre",
    kind: "GLOBAL", pillar: "CARE",
    dateByCountry: { ES: "2026-09-01", PT: "2026-09-01", FR: "2026-09-01", DE: "2026-09-01", IT: "2026-09-15", GB: "2026-09-01", US: "2026-08-25", CA: "2026-09-02", MX: "2026-08-19" },
    brief: "Vuelta a la rutina · skincare como ritual de septiembre · pack CARE introductorio · CTA descubrir CARE",
    tone: "editorial-cálido", leadDays: 10,
  },

  // ── Q4 — la mina ──────────────────────────────────────────────────────
  {
    slug: "halloween-2026",
    name: "Halloween",
    kind: "GLOBAL", pillar: "PARFUMS",
    dateByCountry: { ES: "2026-10-31", PT: "2026-10-31", FR: "2026-10-31", DE: "2026-10-31", IT: "2026-10-31", GB: "2026-10-31", US: "2026-10-31", CA: "2026-10-31", MX: "2026-10-31" },
    brief: "Halloween · fragancias intensas · noches misteriosas · -20% en orientales y maderosos · CTA descubrir lado oscuro",
    tone: "editorial-cálido", leadDays: 7,
  },
  {
    slug: "buen-fin-2026",
    name: "El Buen Fin (México)",
    kind: "REGIONAL", pillar: "ALL",
    dateByCountry: { MX: "2026-11-13" },
    brief: "Buen Fin · descuentos México · -30% en selección · fin de semana de ofertas · CTA aprovechar Buen Fin",
    tone: "urgente-flash", leadDays: 5,
  },
  {
    slug: "black-friday-2026",
    name: "Black Friday",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-11-27", PT: "2026-11-27", FR: "2026-11-27", DE: "2026-11-27", IT: "2026-11-27", GB: "2026-11-27", US: "2026-11-27", CA: "2026-11-27", MX: "2026-11-27" },
    brief: "Black Friday · -40% en todo · solo 24h · countdown · top 5 perfumes · sin distracciones · 1 CTA gigante",
    tone: "urgente-flash", leadDays: 7,
  },
  {
    slug: "cyber-monday-2026",
    name: "Cyber Monday",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-11-30", PT: "2026-11-30", FR: "2026-11-30", DE: "2026-11-30", IT: "2026-11-30", GB: "2026-11-30", US: "2026-11-30", CA: "2026-11-30", MX: "2026-11-30" },
    brief: "Cyber Monday · extensión del Black Friday · última oportunidad · -35% selección · CTA aprovecha antes de medianoche",
    tone: "urgente-flash", leadDays: 4,
  },
  {
    slug: "guia-regalos-navidad-2026",
    name: "Guía de regalos de Navidad",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-12-10", PT: "2026-12-10", FR: "2026-12-10", DE: "2026-12-10", IT: "2026-12-10", GB: "2026-12-10", US: "2026-12-10", CA: "2026-12-10", MX: "2026-12-10" },
    brief: "Guía de regalos Navidad · ideas por presupuesto (menos de 30€, menos de 50€, menos de 100€) · packs RITUAL · CTA ver guía",
    tone: "editorial-cálido", leadDays: 14,
  },
  {
    slug: "ultima-oportunidad-navidad-2026",
    name: "Última oportunidad envío Navidad",
    kind: "GLOBAL", pillar: "ALL",
    dateByCountry: { ES: "2026-12-19", PT: "2026-12-19", FR: "2026-12-19", DE: "2026-12-18", IT: "2026-12-19", GB: "2026-12-19", US: "2026-12-19", CA: "2026-12-18", MX: "2026-12-19" },
    brief: "Última oportunidad · entrega antes de Reyes · solo 48h · envío express · CTA pide antes de que se acabe",
    tone: "urgente-flash", leadDays: 3,
  },
  {
    slug: "san-esteban-2026",
    name: "Rebajas Boxing Day",
    kind: "REGIONAL", pillar: "ALL",
    dateByCountry: { GB: "2026-12-26", US: "2026-12-26", CA: "2026-12-26" },
    brief: "Boxing Day · post-Christmas sale · -30% across the line · fresh start · CTA shop the sale",
    tone: "comercial-directo", leadDays: 5,
  },
  {
    slug: "reyes-magos-2026",
    name: "Reyes Magos",
    kind: "REGIONAL", pillar: "ALL",
    dateByCountry: { ES: "2027-01-06", PT: "2027-01-06", MX: "2027-01-06", IT: "2027-01-06" },
    brief: "Día de Reyes · último gran momento de regalo · ideas última hora · CTA pide ya para mañana",
    tone: "urgente-flash", leadDays: 4,
  },

  // ── BRAND OWN events (no festividad oficial — momentos de marca) ──────
  {
    slug: "lanzamiento-ritual-q2-2026",
    name: "Lanzamiento RITUAL Q2",
    kind: "BRAND_OWN", pillar: "RITUAL",
    dateByCountry: { ES: "2026-06-05", FR: "2026-06-05", DE: "2026-06-05", IT: "2026-06-05", GB: "2026-06-05", US: "2026-06-05", CA: "2026-06-05", MX: "2026-06-05" },
    brief: "Lanzamiento set RITUAL edición verano · packaging exclusivo · 1 CTA grande · sin precio en hero · lujo minimal",
    tone: "lujo-minimalista", leadDays: 10,
  },
  {
    slug: "descarga-app-marzo-2026",
    name: "Promo descarga app (Q2)",
    kind: "BRAND_OWN", pillar: "ALL",
    dateByCountry: { ES: "2026-04-15", FR: "2026-04-15", DE: "2026-04-15", IT: "2026-04-15", GB: "2026-04-15", US: "2026-04-15", CA: "2026-04-15", MX: "2026-04-15" },
    brief: "Descarga la app divain · 10% off solo app · pushes con ofertas exclusivas · CTA descargar (iOS / Android)",
    tone: "comercial-directo", leadDays: 5,
    segmentHint: "no-app",
  },
];

// Pick the right ISO date for a given store from a calendar event. Returns null
// if the event doesn't apply to any country this store serves OR if no shape we
// know how to read has a date.
//
// The webhook lets upstream systems push `dateByCountry` as arbitrary JSON, so
// we have to tolerate several shapes that have shown up in practice:
//   1. String value: { "ES": "2026-05-09" }                       ← canonical
//   2. Object with a `date` field: { "ES": { date: "2026-05-09", ... } }
//   3. Object containing nested string dates: { "ES": { sendAt: "2026-05-09" } }
//   4. Plain Date instance (serialised through JSON.stringify earlier)
//   5. Empty/garbage — we fall back to extracting a yyyy-mm-dd substring from
//      the event slug (e.g. "eu-2026-05-ES-todo-a-11-99eur-9" → 2026-05-09)
export function dateForStore(event: CalendarEvent, storeSlug: string): string | null {
  const countries = STORE_COUNTRY[storeSlug] ?? [];
  for (const c of countries) {
    const raw = event.dateByCountry[c as keyof typeof event.dateByCountry];
    const fromValue = coerceDate(raw);
    if (fromValue) return fromValue;
  }
  // Slug fallback — most pushed events embed the date in their slug. Pattern
  // is "<prefix>-YYYY-MM-...-<dayNumber>", e.g. eu-2026-05-ES-foo-9 → 2026-05-09.
  return extractDateFromSlug(event.slug);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return looksLikeIsoDate(v) ? v.slice(0, 10) : null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    // Common nested keys we've seen upstream use.
    for (const key of ["date", "sendAt", "send_at", "startDate", "start_date", "iso"]) {
      const inner = v[key];
      if (typeof inner === "string" && looksLikeIsoDate(inner)) return inner.slice(0, 10);
    }
    // Last resort: take the first stringy value that looks date-shaped.
    for (const val of Object.values(v)) {
      if (typeof val === "string" && looksLikeIsoDate(val)) return val.slice(0, 10);
    }
  }
  return null;
}

function looksLikeIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function extractDateFromSlug(slug: string): string | null {
  // Capture "YYYY-MM" followed later by "-NN" where NN is the day (last numeric
  // segment in the slug). Range-checks the day [01..31] to avoid grabbing a
  // discount value like "60pct".
  const ym = slug.match(/(\d{4})-(\d{2})/);
  if (!ym) return null;
  const tail = slug.match(/-(\d{1,2})$/);
  if (!tail) return null;
  const day = parseInt(tail[1], 10);
  if (!(day >= 1 && day <= 31)) return null;
  return `${ym[1]}-${ym[2]}-${String(day).padStart(2, "0")}`;
}
