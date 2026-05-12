// Shopify Admin GraphQL client — one per store.
//
// Authentication uses OAuth client_credentials. The user pegs the Client ID (scope =
// store slug) and Client secret (scope = `${slug}:secret`) in Settings. This module
// exchanges them for a short-lived access token at /admin/oauth/access_token and
// caches it in-memory. On 401 we clear the cache and re-exchange — handles secret
// rotation / token revocation transparently.
//
// Pagination uses cursor-based queries (Shopify's preferred mode). For huge stores
// (1M+ rows) we'll switch to the Bulk Operations API later — until then, 250-row
// pages are simple and fast enough.

import { getCredential } from "../credentials";
import { prisma } from "../db";

export const SHOPIFY_API_VERSION = "2025-01";

// ── Access token cache ────────────────────────────────────────────────────
// Tokens issued by client_credentials are typically short-lived. We cache per-store
// in-memory until ~60s before expiry, then re-exchange. Cache is per process; multiple
// instances will each do their own exchange, which is fine — exchange is cheap.

type TokenEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenEntry>();

function invalidateToken(storeSlug: string) {
  tokenCache.delete(storeSlug);
}

async function exchangeClientCredentials(storeSlug: string): Promise<{ token: string; expiresAt: number; shopifyDomain: string }> {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) throw new Error(`Store with slug "${storeSlug}" not found`);

  const idCred = await getCredential("SHOPIFY", storeSlug);
  if (!idCred) throw new Error(`Shopify Client ID not configured for ${storeSlug} · add it in Settings → Stores`);
  const secretCred = await getCredential("SHOPIFY", `${storeSlug}:secret`);
  if (!secretCred) throw new Error(`Shopify Client secret not configured for ${storeSlug} · add it in Settings → Stores`);

  const res = await fetch(`https://${store.shopifyDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: idCred.value,
      client_secret: secretCred.value,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify OAuth ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Shopify OAuth: missing access_token in response");

  const ttlSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  // Refresh 60s early so callers never get a token that expires mid-flight.
  const expiresAt = Date.now() + Math.max(ttlSec - 60, 60) * 1000;
  return { token: json.access_token, expiresAt, shopifyDomain: store.shopifyDomain };
}

// Public — used by the webhook handler for HMAC verification.
export async function getShopifyClientSecret(storeSlug: string): Promise<string> {
  const cred = await getCredential("SHOPIFY", `${storeSlug}:secret`);
  if (!cred) throw new Error(`Shopify Client secret not configured for ${storeSlug}`);
  return cred.value;
}

async function getStoreContext(storeSlug: string): Promise<{ token: string; shopifyDomain: string }> {
  const cached = tokenCache.get(storeSlug);
  if (cached && cached.expiresAt > Date.now()) {
    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { shopifyDomain: true } });
    if (!store) throw new Error(`Store with slug "${storeSlug}" not found`);
    return { token: cached.token, shopifyDomain: store.shopifyDomain };
  }
  const fresh = await exchangeClientCredentials(storeSlug);
  tokenCache.set(storeSlug, { token: fresh.token, expiresAt: fresh.expiresAt });
  return { token: fresh.token, shopifyDomain: fresh.shopifyDomain };
}

// Generic GraphQL call. Returns the data payload, throws on errors.
// On 401 we clear the cached token and retry once — covers secret rotation.
export async function shopifyGraphql<T = unknown>(
  storeSlug: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let { token, shopifyDomain } = await getStoreContext(storeSlug);

  const fire = async () => fetch(`https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
      "Accept": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  let res = await fire();
  if (res.status === 401) {
    invalidateToken(storeSlug);
    ({ token, shopifyDomain } = await getStoreContext(storeSlug));
    res = await fire();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}

// Test connection — used by /api/credentials/test. Returns the shop name on success.
export async function testShopifyConnection(storeSlug: string): Promise<{ ok: true; shop: string } | { ok: false; error: string }> {
  try {
    const data = await shopifyGraphql<{ shop: { name: string; myshopifyDomain: string } }>(storeSlug, `{ shop { name myshopifyDomain } }`);
    return { ok: true, shop: data.shop.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "test failed" };
  }
}

// ── Bulk customer iterator ────────────────────────────────────────────────
// Paginated query over Shopify customers. Yields batches of 250 (Shopify's per-page
// max for standard queries). For huge stores (1M+ customers) Shopify also has a
// Bulk Operations API that runs server-side and returns a JSONL file — we'll switch
// to that when sync time exceeds 30 minutes. Until then this is simpler.

export type ShopifyCustomer = {
  id: string;                    // gid://shopify/Customer/123
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: string | null;
  state: string;                 // ENABLED, DISABLED, INVITED, DECLINED
  emailMarketingConsent: { marketingState: string; marketingOptInLevel: string | null; consentUpdatedAt: string | null } | null;
  numberOfOrders: number;
  amountSpent: { amount: string; currencyCode: string };
  defaultAddress: { country: string | null; countryCodeV2: string | null; province: string | null } | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Metafields we mirror: app.installed + app.last_push_at
  appInstalled:  { value: string | null } | null;
  appLastPushAt: { value: string | null } | null;
};

const CUSTOMERS_PAGE_QUERY = /* GraphQL */ `
  query CustomersPage($cursor: String, $first: Int!) {
    customers(first: $first, after: $cursor, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        email
        firstName
        lastName
        phone
        locale
        state
        emailMarketingConsent { marketingState marketingOptInLevel consentUpdatedAt }
        numberOfOrders
        amountSpent { amount currencyCode }
        defaultAddress { country countryCodeV2 province }
        tags
        createdAt
        updatedAt
        appInstalled:  metafield(namespace: "app", key: "installed")    { value }
        appLastPushAt: metafield(namespace: "app", key: "last_push_at") { value }
      }
    }
  }
`;

// Yields batches of customers; consumer controls pace.
export async function* iterateShopifyCustomers(storeSlug: string, pageSize = 250): AsyncGenerator<ShopifyCustomer[]> {
  let cursor: string | null = null;
  while (true) {
    const data: { customers: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyCustomer[] } } =
      await shopifyGraphql(storeSlug, CUSTOMERS_PAGE_QUERY, { cursor, first: pageSize });
    yield data.customers.nodes;
    if (!data.customers.pageInfo.hasNextPage) break;
    cursor = data.customers.pageInfo.endCursor;
  }
}

// ── Bulk product iterator ────────────────────────────────────────────────

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: string;                  // ACTIVE, ARCHIVED, DRAFT
  tags: string[];
  descriptionHtml: string | null;
  createdAt: string;
  updatedAt: string;
  featuredImage: { url: string } | null;
  variants: { nodes: { id: string; sku: string | null; title: string; price: string; compareAtPrice: string | null; inventoryQuantity: number | null; availableForSale: boolean; image: { url: string } | null }[] };
};

const PRODUCTS_PAGE_QUERY = /* GraphQL */ `
  query ProductsPage($cursor: String, $first: Int!) {
    products(first: $first, after: $cursor, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        vendor
        productType
        status
        tags
        descriptionHtml
        createdAt
        updatedAt
        featuredImage { url }
        variants(first: 100) {
          nodes {
            id
            sku
            title
            price
            compareAtPrice
            inventoryQuantity
            availableForSale
            image { url }
          }
        }
      }
    }
  }
`;

export async function* iterateShopifyProducts(storeSlug: string, pageSize = 100): AsyncGenerator<ShopifyProduct[]> {
  let cursor: string | null = null;
  while (true) {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyProduct[] } } =
      await shopifyGraphql(storeSlug, PRODUCTS_PAGE_QUERY, { cursor, first: pageSize });
    yield data.products.nodes;
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
}
