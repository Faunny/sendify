// POST /api/shopify/webhooks/register
//
// Registers Sendify's webhook endpoint inside the store's Shopify so events flow to
// /api/shopify/webhook?store=<storeSlug> automatically. Body: { storeSlug: string }.
//
// Run once per store after pasting the access token. Idempotent — Shopify rejects
// duplicate topic+URL pairs cleanly. The endpoint also returns the current list of
// registered webhooks so the UI can show what's active.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shopifyGraphql } from "@/lib/providers/shopify";

const TOPICS = [
  "CUSTOMERS_CREATE",
  "CUSTOMERS_UPDATE",
  "CUSTOMERS_DELETE",
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_CANCELLED",
  "CHECKOUTS_CREATE",
  "CHECKOUTS_UPDATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
];

const REGISTER_MUTATION = /* GraphQL */ `
  mutation Register($topic: WebhookSubscriptionTopic!, $url: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $url, format: JSON }
    ) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

const LIST_QUERY = /* GraphQL */ `
  { webhookSubscriptions(first: 50) { nodes { id topic callbackUrl { ... on WebhookHttpEndpoint { callbackUrl } } } } }
`;

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { storeSlug } = await req.json().catch(() => ({} as { storeSlug?: string }));
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
  const callbackUrl = `${appUrl}/api/shopify/webhook?store=${encodeURIComponent(storeSlug)}`;

  const results: { topic: string; ok: boolean; error?: string }[] = [];
  for (const topic of TOPICS) {
    try {
      const data = await shopifyGraphql<{
        webhookSubscriptionCreate: { webhookSubscription: { id: string; topic: string } | null; userErrors: { field: string[]; message: string }[] };
      }>(storeSlug, REGISTER_MUTATION, { topic, url: callbackUrl });
      const errs = data.webhookSubscriptionCreate.userErrors;
      // "address for this topic has already been taken" is fine — means already registered.
      const okErrors = errs.every((e) => /already.*taken|already exists/i.test(e.message));
      results.push({ topic, ok: errs.length === 0 || okErrors, error: errs.length > 0 ? errs.map((e) => e.message).join("; ") : undefined });
    } catch (e) {
      results.push({ topic, ok: false, error: e instanceof Error ? e.message : "register failed" });
    }
  }

  return NextResponse.json({ ok: true, callbackUrl, results });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeSlug = url.searchParams.get("storeSlug");
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });

  try {
    const data = await shopifyGraphql<{ webhookSubscriptions: { nodes: { id: string; topic: string; callbackUrl: { callbackUrl: string } | null }[] } }>(
      storeSlug,
      LIST_QUERY,
    );
    return NextResponse.json({ ok: true, subscriptions: data.webhookSubscriptions.nodes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "list failed" }, { status: 500 });
  }
}
