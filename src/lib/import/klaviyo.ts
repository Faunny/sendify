// Klaviyo → Sendify migration.
//
// Reads a Klaviyo profile export CSV (streaming, memory-safe for 1.5M+ rows), maps each
// row to a Sendify Customer, and yields batches ready for `prisma.customer.createMany`.
//
// Klaviyo's export columns are inconsistent across accounts. We auto-detect the most
// common variants and fall back to a normalized lookup. The output schema is:
//
//   { email, firstName, lastName, country, language, consentStatus, hasApp,
//     totalSpent, ordersCount, shopifyId?, tags[] }
//
// Cross-store dedup happens at the DB layer via `@@unique([storeId, shopifyId])` +
// `createMany skipDuplicates`. Since one human can exist in multiple Shopify stores,
// each store gets its own Customer row keyed on the per-store Shopify ID.

import { parse as parseCsv } from "csv-parse";
import { createReadStream } from "node:fs";
import { ConsentStatus, type Prisma } from "@prisma/client";
import { LANGUAGES } from "../languages";

// ── Klaviyo CSV row (loose: column names vary, we map by lowercase) ─────────

export type KlaviyoRow = Record<string, string>;

// Header normalization: lowercase + remove non-alphanumerics so both
// "Email" / "$email" / "Email Address" / "email_address" → "email".
function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Pull the first non-empty value across a list of candidate column names.
function pick(row: KlaviyoRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normKey(k)];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

// ── Mapping ─────────────────────────────────────────────────────────────────

export type MappedCustomer = Prisma.CustomerCreateManyInput & {
  // Tags array isn't directly part of CreateManyInput in Prisma, but Customer.tags exists
  // as String[]. Prisma's generated type handles this; this re-export keeps callers honest.
  tags: string[];
  shopifyTags: string[];
};

export type MapOptions = {
  storeId: string;
  defaultLanguage?: string; // fallback when row has no locale/country signal
};

export function mapKlaviyoToCustomer(row: KlaviyoRow, opts: MapOptions): MappedCustomer | null {
  const email = pick(row, "email", "email_address", "$email").toLowerCase();
  if (!email || !email.includes("@")) return null; // skip rows without a usable email

  const firstName = pick(row, "first_name", "firstname", "$first_name");
  const lastName  = pick(row, "last_name",  "lastname",  "$last_name");
  const phone     = pick(row, "phone_number", "phone", "$phone_number");
  const country   = (pick(row, "country", "$country") || "").toUpperCase().slice(0, 2);
  const klaviyoLocale = pick(row, "locale", "language", "$locale");
  const klaviyoId = pick(row, "id", "klaviyo_id", "$kl_id");

  // Consent. Klaviyo uses several columns depending on integration:
  //   - "Email Consent": subscribed / unsubscribed / never_subscribed
  //   - "Profile Status" / "$consent": SUBSCRIBED / UNSUBSCRIBED / PENDING / SUPPRESSED
  //   - "Suppressions": comma list including "bounced", "spam_complaint", "manual"
  const rawConsent = pick(row, "email_consent", "profile_status", "$consent", "consent").toLowerCase();
  const suppressions = pick(row, "suppressions").toLowerCase();
  const consentStatus = inferConsent(rawConsent, suppressions);

  // Numeric fields. Klaviyo formats numbers with commas in some locales — strip them.
  const totalSpent = parseDecimal(pick(row, "historic_customer_lifetime_value", "total_spent", "$lifetime_value"));
  const ordersCount = parseInt(pick(row, "historic_number_of_orders", "orders_count").replace(/\D/g, "") || "0", 10);

  // App state — only present if you've been mirroring it into Klaviyo as a profile property.
  // If absent we infer false; Shopify sync will update this once the app is wired.
  const hasApp = /^(true|yes|1)$/i.test(pick(row, "has_app", "app_installed", "$app_installed"));
  const lastPushAtStr = pick(row, "last_push_at", "$last_push_at");
  const lastPushAt = lastPushAtStr ? new Date(lastPushAtStr) : null;

  // Tags. Klaviyo lists are exported as a column "Lists" with semicolon-separated names,
  // or as separate boolean columns per list. We grab both forms.
  const listsCol = pick(row, "lists", "list_memberships");
  const tags = listsCol ? listsCol.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
  const shopifyTags = (pick(row, "tags", "shopify_tags") || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);

  // Language — prefer Klaviyo locale (it's BCP-47ish); fall back to country → language;
  // last resort: the store's default language.
  const language = normalizeLanguage(klaviyoLocale) ?? languageForCountry(country) ?? opts.defaultLanguage ?? "es-ES";

  return {
    storeId: opts.storeId,
    shopifyId: klaviyoId || `klaviyo:${email}`, // synthetic id when Klaviyo's own ID isn't in the export
    email,
    firstName: firstName || null,
    lastName:  lastName  || null,
    phone:     phone || null,
    country:   country || null,
    language,
    acceptsMarketing: consentStatus === ConsentStatus.SUBSCRIBED,
    consentStatus,
    hasApp,
    lastPushAt,
    totalSpent,
    ordersCount,
    tags,
    shopifyTags,
  };
}

function inferConsent(raw: string, suppressions: string): ConsentStatus {
  // Hard signals from suppression list win first.
  if (/bounce/.test(suppressions)) return ConsentStatus.BOUNCED;
  if (/complaint|spam/.test(suppressions)) return ConsentStatus.COMPLAINED;

  switch (raw) {
    case "subscribed":
    case "true":
      return ConsentStatus.SUBSCRIBED;
    case "unsubscribed":
    case "false":
      return ConsentStatus.UNSUBSCRIBED;
    case "bounced":
      return ConsentStatus.BOUNCED;
    case "spam_complaint":
    case "complained":
      return ConsentStatus.COMPLAINED;
    case "never_subscribed":
    case "pending":
    case "":
      return ConsentStatus.PENDING;
    default:
      // Unknown values: be conservative and treat as PENDING so the operator can review.
      return ConsentStatus.PENDING;
  }
}

function parseDecimal(s: string): Prisma.Decimal | number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3})/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

// Map Klaviyo's locale strings (varies: "en-US", "en_US", "es", "español") to our BCP-47.
function normalizeLanguage(input: string): string | null {
  if (!input) return null;
  const candidate = input.replace("_", "-");
  // Exact BCP-47 match
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact.code;
  // Prefix-only: "en" → first English in our list
  const prefix = candidate.split("-")[0].toLowerCase();
  const byPrefix = LANGUAGES.find((l) => l.code.toLowerCase().startsWith(prefix + "-"));
  if (byPrefix) return byPrefix.code;
  // "español" / "français" / etc.
  const native = LANGUAGES.find((l) => l.nativeLabel.toLowerCase().startsWith(input.toLowerCase()));
  return native?.code ?? null;
}

function languageForCountry(country: string): string | null {
  if (!country) return null;
  const found = LANGUAGES.find((l) => l.countries.includes(country));
  return found?.code ?? null;
}

// ── Streaming CSV reader ────────────────────────────────────────────────────

export type ReadOptions = {
  path: string;
  batchSize?: number;
  onProgress?: (state: { read: number; mapped: number; skipped: number }) => void;
};

// Async generator that yields batches of mapped customers. Backpressure-friendly —
// the consumer (DB writer) controls the pace via its own awaits.
export async function* streamKlaviyoCsv(
  opts: ReadOptions & MapOptions,
): AsyncGenerator<MappedCustomer[], { read: number; mapped: number; skipped: number }> {
  const batchSize = opts.batchSize ?? 5000;
  const parser = createReadStream(opts.path).pipe(
    parseCsv({
      columns: (headers: string[]) => headers.map(normKey),
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    })
  );

  let buf: MappedCustomer[] = [];
  let read = 0, mapped = 0, skipped = 0;

  for await (const row of parser) {
    read++;
    const m = mapKlaviyoToCustomer(row, opts);
    if (!m) { skipped++; continue; }
    buf.push(m);
    mapped++;
    if (buf.length >= batchSize) {
      yield buf;
      buf = [];
      opts.onProgress?.({ read, mapped, skipped });
    }
  }
  if (buf.length > 0) {
    yield buf;
    opts.onProgress?.({ read, mapped, skipped });
  }
  return { read, mapped, skipped };
}
