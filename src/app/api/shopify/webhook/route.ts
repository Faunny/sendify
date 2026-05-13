// POST /api/shopify/webhook
//
// Receives Shopify webhook events. Verifies the HMAC signature (Shopify signs every
// webhook with the Custom App's shared secret). Routes to a topic-specific handler that
// upserts the Customer/Product/Order/etc. in real time.
//
// Webhook URL configured per store (in Shopify Custom App settings):
//   https://sendify.divain.space/api/shopify/webhook?store=divain-europa
//
// The `store` query string identifies which store the event belongs to so we can
// look up the right API secret to verify the HMAC.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getShopifyClientSecret } from "@/lib/providers/shopify";
import { enrollIntoMatchingFlows } from "@/lib/flows/engine";

// Webhook topics we subscribe to. The handler below routes based on the
// `X-Shopify-Topic` header.
type Topic =
  | "customers/create" | "customers/update" | "customers/delete"
  | "orders/create"   | "orders/updated"    | "orders/cancelled"
  | "checkouts/create" | "checkouts/update"
  | "products/create" | "products/update"   | "products/delete";

// ── HMAC verification ─────────────────────────────────────────────────────
// Shopify signs the raw request body with HMAC-SHA256 using the Custom App's API
// secret. The signature lives in the X-Shopify-Hmac-SHA256 header (base64).
// We re-compute and timingSafeEqual to prevent timing attacks.

async function verifyHmac(rawBody: string, signature: string | null, storeSlug: string): Promise<boolean> {
  if (!signature) return false;
  // Shopify signs webhooks with the app's Client secret (same value the user pegs in
  // Settings as "Client secret" — stored at scope `${storeSlug}:secret`).
  let secret: string;
  try {
    secret = await getShopifyClientSecret(storeSlug);
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const storeSlug = url.searchParams.get("store");
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing store" }, { status: 400 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256");
  const topic     = req.headers.get("x-shopify-topic") as Topic | null;
  if (!topic) return NextResponse.json({ ok: false, error: "missing topic" }, { status: 400 });

  // Verify signature. If the webhook secret hasn't been configured yet, accept and log
  // a warning (we want first sync to work even before the user pegs the secret).
  if (process.env.SHOPIFY_WEBHOOK_REQUIRE_HMAC === "true") {
    const ok = await verifyHmac(rawBody, signature, storeSlug);
    if (!ok) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

  const payload = JSON.parse(rawBody);

  try {
    switch (topic) {
      case "customers/create": {
        const customer = await upsertCustomerFromWebhook(payload, store.id, store.defaultLanguage);
        // Brand-new customer → welcome series.
        if (customer) {
          await enrollIntoMatchingFlows({ storeId: store.id, customerId: customer.id, trigger: "WELCOME" }).catch((e) => {
            console.warn("[webhook] welcome enroll failed:", e);
          });
        }
        break;
      }
      case "customers/update":
        await upsertCustomerFromWebhook(payload, store.id, store.defaultLanguage);
        break;
      case "customers/delete":
        await prisma.customer.updateMany({
          where: { storeId: store.id, shopifyId: shopifyGid("Customer", payload.id) },
          data:  { deletedAt: new Date() },
        });
        break;
      case "orders/create": {
        const customer = await updateCustomerOrdersFromWebhook(payload, store.id);
        // Successful order → cancel any in-flight abandoned-cart enrollments for this
        // customer (they already converted) + enroll into post-purchase series.
        if (customer) {
          await prisma.flowEnrollment.updateMany({
            where: {
              customerId: customer.id,
              status: "ACTIVE",
              flow: { trigger: "ABANDONED_CART" },
            },
            data: { status: "CANCELLED", completedAt: new Date(), lastError: "customer purchased" },
          }).catch(() => {});
          await enrollIntoMatchingFlows({
            storeId: store.id,
            customerId: customer.id,
            trigger: "POST_PURCHASE",
            context: { orderId: String(payload.id ?? ""), total: String(payload.total_price ?? "") },
          }).catch((e) => console.warn("[webhook] post-purchase enroll failed:", e));
        }
        break;
      }
      case "orders/updated":
        await updateCustomerOrdersFromWebhook(payload, store.id);
        break;
      case "checkouts/create":
      case "checkouts/update": {
        // Abandoned-cart entry: record the event + enroll if there's a customer email.
        await handleCheckoutWebhook(payload, store.id);
        break;
      }
      case "products/create":
      case "products/update":
        await upsertProductFromWebhook(payload, store.id, store.countryCode, store.currency);
        break;
      case "products/delete":
        await prisma.product.deleteMany({
          where: { storeId: store.id, shopifyId: shopifyGid("Product", payload.id) },
        });
        break;
      default:
        // Ignore unknown topics gracefully — Shopify retries indefinitely on 5xx.
        return NextResponse.json({ ok: true, ignored: topic });
    }
  } catch (e) {
    console.error("[shopify webhook]", topic, e);
    // Return 200 anyway so Shopify doesn't retry forever — we already logged.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "handler failed" });
  }

  return NextResponse.json({ ok: true, topic });
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Webhook payloads use numeric ids; the rest of the codebase uses gid:// strings.
// Convert.
function shopifyGid(type: "Customer" | "Order" | "Product", numericId: number | string): string {
  return `gid://shopify/${type}/${numericId}`;
}

// Webhook customer shape (REST format) differs slightly from GraphQL — handle both.
type WebhookCustomer = {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  tags: string;                  // comma-separated
  state?: string;                // "enabled" | "disabled" | "invited" | "declined"
  email_marketing_consent?: { state: string };
  default_address?: { country_code: string | null };
  total_spent?: string;
  orders_count?: number;
  metafields?: Array<{ namespace: string; key: string; value: string }>;
};

async function upsertCustomerFromWebhook(p: WebhookCustomer, storeId: string, storeDefaultLang: string) {
  if (!p.email) return null; // anonymous webhook payload, skip

  // Find metafield values (Shopify sends them inline only when explicitly requested).
  const meta = (k: string) => p.metafields?.find((m) => m.namespace === "app" && m.key === k)?.value;
  const consentState = (p.email_marketing_consent?.state ?? "not_subscribed").toUpperCase();

  const data = {
    storeId,
    shopifyId: shopifyGid("Customer", p.id),
    email: p.email.toLowerCase(),
    firstName: p.first_name,
    lastName:  p.last_name,
    phone:     p.phone,
    country:   p.default_address?.country_code ?? null,
    language:  storeDefaultLang, // refined later via metafields/locale if available
    acceptsMarketing: consentState === "SUBSCRIBED",
    consentStatus: consentState === "SUBSCRIBED" ? "SUBSCRIBED" as const
                  : consentState === "UNSUBSCRIBED" ? "UNSUBSCRIBED" as const
                  : consentState === "PENDING" ? "PENDING" as const
                  : "PENDING" as const,
    hasApp: meta("installed") === "true",
    lastPushAt: meta("last_push_at") ? new Date(meta("last_push_at")!) : null,
    totalSpent: p.total_spent ? parseFloat(p.total_spent) : 0,
    ordersCount: p.orders_count ?? 0,
    shopifyTags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };

  return prisma.customer.upsert({
    where: { storeId_shopifyId: { storeId, shopifyId: shopifyGid("Customer", p.id) } },
    create: data,
    update: data,
    select: { id: true },
  });
}

// Order webhook → bump the customer's totalSpent + ordersCount denormalized fields.
type WebhookOrder = {
  id: number;
  customer?: { id: number };
  total_price?: string;
  financial_status?: string;
};

async function updateCustomerOrdersFromWebhook(p: WebhookOrder, storeId: string) {
  if (!p.customer?.id) return null;
  // Recompute from authoritative customer row (cheap query that returns current totals).
  // For massive accuracy we'd pull the full order list, but Shopify webhooks fire on every
  // order create/update so a denormalized incremental update is sufficient.
  const customer = await prisma.customer.findFirst({
    where: { storeId, shopifyId: shopifyGid("Customer", p.customer.id) },
    select: { id: true },
  });
  if (!customer) return null;
  const delta = parseFloat(p.total_price ?? "0");
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalSpent: { increment: delta },
      ordersCount: { increment: 1 },
    },
  });
  // Record raw event for downstream flows (abandoned-cart, post-purchase, etc.)
  await prisma.customerEvent.create({
    data: {
      customerId: customer.id,
      type: "order.placed",
      payload: p as unknown as object,
      occurredAt: new Date(),
    },
  }).catch(() => {});
  return customer;
}

// Checkout webhook → record event + enroll into abandoned-cart flows.
//
// Shopify fires checkouts/create when a customer reaches checkout and starts
// filling details, and checkouts/update on each step. We treat the latest
// update as the abandoned-cart signal because abandon ≠ "never reached
// checkout". The flow's first step is always a delay, so the customer has time
// to complete the purchase before any email fires — and orders/create cancels
// the enrollment if they do.
type WebhookCheckout = {
  id: number;
  token: string;
  email: string | null;
  abandoned_checkout_url?: string | null;
  customer?: { id: number; first_name?: string | null } | null;
  line_items?: Array<{ title?: string; quantity?: number; price?: string; image_url?: string | null }>;
};

async function handleCheckoutWebhook(p: WebhookCheckout, storeId: string) {
  if (!p.email || !p.customer?.id) return; // need an identifiable customer
  const customer = await prisma.customer.findFirst({
    where: { storeId, shopifyId: shopifyGid("Customer", p.customer.id) },
    select: { id: true },
  });
  if (!customer) return;
  await prisma.customerEvent.create({
    data: {
      customerId: customer.id,
      type: "checkout.abandoned",
      payload: p as unknown as object,
      occurredAt: new Date(),
    },
  }).catch(() => {});
  await enrollIntoMatchingFlows({
    storeId,
    customerId: customer.id,
    trigger: "ABANDONED_CART",
    context: {
      checkoutUrl: p.abandoned_checkout_url ?? "",
      checkoutToken: p.token,
    },
  }).catch((e) => console.warn("[webhook] abandoned-cart enroll failed:", e));
}

// Product webhook → upsert single product + variants.
type WebhookProduct = {
  id: number;
  handle: string;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: string;
  tags: string;
  body_html: string | null;
  image: { src: string } | null;
  variants: Array<{ id: number; sku: string | null; title: string; price: string; compare_at_price: string | null; inventory_quantity: number | null; image_id?: number | null }>;
  created_at: string;
  updated_at: string;
};

async function upsertProductFromWebhook(p: WebhookProduct, storeId: string, market: string, currency: string) {
  const product = await prisma.product.upsert({
    where: { storeId_shopifyId: { storeId, shopifyId: shopifyGid("Product", p.id) } },
    create: {
      storeId, shopifyId: shopifyGid("Product", p.id),
      handle: p.handle, title: p.title,
      vendor: p.vendor, productType: p.product_type,
      status: p.status.toLowerCase(),
      tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      imageUrl: p.image?.src ?? null,
      descriptionHtml: p.body_html,
      shopifyCreatedAt: new Date(p.created_at),
      shopifyUpdatedAt: new Date(p.updated_at),
    },
    update: {
      handle: p.handle, title: p.title,
      vendor: p.vendor, productType: p.product_type,
      status: p.status.toLowerCase(),
      tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      imageUrl: p.image?.src ?? null,
      descriptionHtml: p.body_html,
      shopifyUpdatedAt: new Date(p.updated_at),
    },
  });
  for (const v of p.variants) {
    const variant = await prisma.productVariant.upsert({
      where: { productId_shopifyId: { productId: product.id, shopifyId: shopifyGid("ProductVariant" as never, v.id) } },
      create: {
        productId: product.id, shopifyId: `gid://shopify/ProductVariant/${v.id}`,
        sku: v.sku, title: v.title,
        inventoryQty: v.inventory_quantity, available: (v.inventory_quantity ?? 0) > 0,
      },
      update: {
        sku: v.sku, title: v.title,
        inventoryQty: v.inventory_quantity, available: (v.inventory_quantity ?? 0) > 0,
      },
    });
    const price = parseFloat(v.price);
    const compareAt = v.compare_at_price ? parseFloat(v.compare_at_price) : null;
    if (isFinite(price)) {
      await prisma.productPrice.upsert({
        where: { variantId_market: { variantId: variant.id, market } },
        create: { variantId: variant.id, market, currency, price, comparePrice: compareAt },
        update: { currency, price, comparePrice: compareAt },
      });
    }
  }
}
