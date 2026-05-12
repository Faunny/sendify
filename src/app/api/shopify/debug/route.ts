// GET /api/shopify/debug?storeSlug=...
//
// One-shot diagnostic: runs every step of the Shopify integration in order and
// reports exactly where it breaks. Use when "Sync now" silently does nothing
// and you need to see whether (a) creds are stored, (b) OAuth exchange works,
// (c) Shopify accepts the resulting token, (d) the customers query returns rows.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/credentials";
import { shopifyGraphql } from "@/lib/providers/shopify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const storeSlug = url.searchParams.get("storeSlug") ?? "divain-europa";

  const steps: Record<string, unknown> = {};
  try {
    // Step 1: store row reachable in Neon
    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { slug: true, shopifyDomain: true, defaultLanguage: true } });
    steps["1_store"] = store ?? { error: "store row not found" };

    // Step 2: are creds saved?
    const idCred     = await getCredential("SHOPIFY", storeSlug);
    const secretCred = await getCredential("SHOPIFY", `${storeSlug}:secret`);
    steps["2_creds"] = {
      clientId:     idCred     ? { len: idCred.value.length,     prefix: idCred.value.slice(0, 6)     + "…" } : null,
      clientSecret: secretCred ? { len: secretCred.value.length, prefix: secretCred.value.slice(0, 6) + "…" } : null,
    };

    if (!store || !idCred) {
      return NextResponse.json({ ok: false, steps, hint: "store or Client ID missing — peg credentials in Settings first" });
    }

    // Step 3: shop query (uses internal OAuth exchange / shpat_ detection)
    try {
      const shop = await shopifyGraphql<{ shop: { name: string; myshopifyDomain: string; primaryDomain: { host: string } } }>(
        storeSlug, `{ shop { name myshopifyDomain primaryDomain { host } } }`,
      );
      steps["3_shop"] = shop.shop;
    } catch (e) {
      steps["3_shop"] = { error: e instanceof Error ? e.message : "shop query failed" };
      return NextResponse.json({ ok: false, steps, hint: "OAuth exchange or first GraphQL call failed — check Client ID/Secret values and that the Custom App is installed in Shopify admin" });
    }

    // Step 4: count customers + products via cheap Shopify counts
    try {
      const counts = await shopifyGraphql<{ customersCount: { count: number }; productsCount: { count: number } }>(
        storeSlug, `{ customersCount { count } productsCount { count } }`,
      );
      steps["4_counts"] = counts;
    } catch (e) {
      steps["4_counts"] = { error: e instanceof Error ? e.message : "counts failed" };
    }

    // Step 5: fetch the first 3 customers (just to see shape)
    try {
      const first = await shopifyGraphql<{ customers: { nodes: { id: string; email: string | null; numberOfOrders: number }[] } }>(
        storeSlug, `{ customers(first: 3) { nodes { id email numberOfOrders } } }`,
      );
      steps["5_sample"] = first.customers.nodes;
    } catch (e) {
      steps["5_sample"] = { error: e instanceof Error ? e.message : "sample failed" };
    }

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, steps, fatal: e instanceof Error ? e.message : "debug threw" });
  }
}
