// Shopify Admin GraphQL client — one per store.
//
// Loads the per-store access token from ProviderCredential (scope = store slug). All
// requests go straight to Shopify Admin API · 2025-01 stable version. Returns parsed
// JSON or throws with the rate-limit / auth detail so the caller can react.
//
// Pagination is handled with cursor-based bulk queries (Shopify's preferred mode for
// >50k rows). We accept a callback so the caller can stream rows into Postgres without
// holding the full result set in memory — important for divain · Europa's ~1M customers.

import { getCredential } from "../credentials";
import { prisma } from "../db";

export const SHOPIFY_API_VERSION = "2025-01";

async function getStoreContext(storeSlug: string): Promise<{ token: string; shopifyDomain: string }> {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) throw new Error(`Store with slug "${storeSlug}" not found`);

  const cred = await getCredential("SHOPIFY", storeSlug);
  if (!cred) throw new Error(`Shopify token not configured for ${storeSlug} · add it in Settings → Stores`);

  return { token: cred.value, shopifyDomain: store.shopifyDomain };
}

// Generic GraphQL call. Returns the data.{queryName} payload, throws on errors.
export async function shopifyGraphql<T = unknown>(
  storeSlug: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { token, shopifyDomain } = await getStoreContext(storeSlug);

  const res = await fetch(`https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
      "Accept": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

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
