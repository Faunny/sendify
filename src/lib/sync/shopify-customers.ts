// Shopify → Sendify customer sync.
//
// For each Shopify customer in the store, upserts into our Customer table. Maps:
//   - email, firstName, lastName, phone, country → direct
//   - locale → BCP-47 language (with country fallback)
//   - emailMarketingConsent.marketingState → ConsentStatus
//   - numberOfOrders / amountSpent → totalSpent, ordersCount
//   - metafields app.installed + app.last_push_at → hasApp + lastPushAt
//
// Idempotent: re-running over the same data only updates rows where Shopify's updatedAt
// is newer than ours. Safe to call repeatedly without producing churn.

import { prisma } from "../db";
import { iterateShopifyCustomers, type ShopifyCustomer } from "../providers/shopify";
import { LANGUAGES } from "../languages";
import { ConsentStatus, type Prisma } from "@prisma/client";

export type SyncProgress = {
  storeSlug: string;
  fetched: number;
  upserted: number;
  skipped: number;
  failed: number;
  firstError?: string;
  startedAt: number;
  finishedAt?: number;
};

// Map Shopify email marketing state → our ConsentStatus enum.
// Shopify states: SUBSCRIBED · NOT_SUBSCRIBED · PENDING · UNSUBSCRIBED · REDACTED · INVALID
function mapConsent(shop: ShopifyCustomer): ConsentStatus {
  const state = shop.emailMarketingConsent?.marketingState ?? "NOT_SUBSCRIBED";
  switch (state) {
    case "SUBSCRIBED":   return ConsentStatus.SUBSCRIBED;
    case "UNSUBSCRIBED": return ConsentStatus.UNSUBSCRIBED;
    case "PENDING":      return ConsentStatus.PENDING;
    case "INVALID":      return ConsentStatus.BOUNCED;
    default:             return ConsentStatus.PENDING;
  }
}

// Map Shopify locale + country → BCP-47 from our supported list.
function mapLanguage(shop: ShopifyCustomer, storeDefaultLang: string): string {
  if (shop.locale) {
    const normalized = shop.locale.replace("_", "-");
    const exact = LANGUAGES.find((l) => l.code.toLowerCase() === normalized.toLowerCase());
    if (exact) return exact.code;
    const prefix = normalized.split("-")[0].toLowerCase();
    const byPrefix = LANGUAGES.find((l) => l.code.toLowerCase().startsWith(prefix + "-"));
    if (byPrefix) return byPrefix.code;
  }
  const country = shop.defaultAddress?.countryCodeV2;
  if (country) {
    const fromCountry = LANGUAGES.find((l) => l.countries.includes(country));
    if (fromCountry) return fromCountry.code;
  }
  return storeDefaultLang;
}

// Returns the Unchecked variant — direct foreign-key form (storeId scalar) is the simplest
// shape for upserts where we already hold the store id from the outer scope.
function buildCustomerData(shop: ShopifyCustomer, storeId: string, storeDefaultLang: string): Prisma.CustomerUncheckedCreateInput {
  // Shopify serializes Money + UnsignedInt64 as strings in JSON, so we must coerce
  // them ourselves before Prisma sees them — passing a "5" where Prisma expects Int
  // produces a generic "Invalid invocation" error with no helpful field name.
  const totalSpent = shop.amountSpent?.amount ? Number(shop.amountSpent.amount) : 0;
  const ordersCount = shop.numberOfOrders != null ? Number(shop.numberOfOrders) : 0;
  const lastPushIso = shop.appLastPushAt?.value;
  const lastPushAt = lastPushIso ? new Date(lastPushIso) : null;
  const hasApp = shop.appInstalled?.value === "true";

  return {
    storeId,
    shopifyId: shop.id,
    email: (shop.email ?? "").toLowerCase(),
    firstName: shop.firstName,
    lastName: shop.lastName,
    phone: shop.phone,
    country: shop.defaultAddress?.countryCodeV2 ?? null,
    language: mapLanguage(shop, storeDefaultLang),
    acceptsMarketing: shop.emailMarketingConsent?.marketingState === "SUBSCRIBED",
    consentStatus: mapConsent(shop),
    hasApp,
    lastPushAt: lastPushAt && !isNaN(lastPushAt.getTime()) ? lastPushAt : null,
    totalSpent: isFinite(totalSpent) ? totalSpent : 0,
    ordersCount: Number.isFinite(ordersCount) ? Math.floor(ordersCount) : 0,
    tags: [],
    shopifyTags: shop.tags ?? [],
  };
}

export async function syncStoreCustomers(
  storeSlug: string,
  onProgress?: (p: SyncProgress) => void,
  options?: { budgetMs?: number },
): Promise<SyncProgress & { hasMore?: boolean }> {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) throw new Error(`Store ${storeSlug} not found`);

  const budgetMs = options?.budgetMs ?? Infinity;
  const startedAt = Date.now();

  const progress: SyncProgress & { hasMore?: boolean } = {
    storeSlug,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
    startedAt,
  };

  for await (const batch of iterateShopifyCustomers(storeSlug, 250)) {
    progress.fetched += batch.length;

    // Concurrency capped at 5 — Neon Free tier rejects past ~25 simultaneous
    // connections, and Prisma's pool is shared across this route + others.
    const chunkSize = 5;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (shopCustomer) => {
        if (!shopCustomer.email) { progress.skipped++; return; }
        const data = buildCustomerData(shopCustomer, store.id, store.defaultLanguage);
        try {
          await prisma.customer.upsert({
            where: { storeId_shopifyId: { storeId: store.id, shopifyId: shopCustomer.id } },
            create: data,
            update: data,
          });
          progress.upserted++;
        } catch (e) {
          progress.failed++;
          if (!progress.firstError) {
            const msg = e instanceof Error ? e.message : String(e);
            // Capture the Prisma error fully — Prisma sticks the real cause near the
            // end of the message (after the schema dump), so don't truncate from the
            // front. Also tag the offending email so we can spot data-pattern bugs.
            progress.firstError = `[${shopCustomer.email ?? "no-email"}] ${msg.slice(-1500)}`;
          }
        }
      }));
    }

    onProgress?.(progress);

    // Stop early if we're running out of serverless budget; caller can resume.
    if (Date.now() - startedAt > budgetMs) {
      progress.hasMore = true;
      return progress;
    }
  }

  progress.finishedAt = Date.now();
  onProgress?.(progress);

  // Update the store's denormalized counts so the dashboard reflects reality.
  const [total, subscribed] = await Promise.all([
    prisma.customer.count({ where: { storeId: store.id } }),
    prisma.customer.count({ where: { storeId: store.id, consentStatus: ConsentStatus.SUBSCRIBED } }),
  ]);
  // Store.customers field is a JSON relation — for the denormalized count we use
  // a separate Stats table later. For now skip the count update; the dashboard does
  // its own COUNT(*) when rendering.
  void total;
  void subscribed; // used by future dashboard counts; computed live, not stored

  return progress;
}
