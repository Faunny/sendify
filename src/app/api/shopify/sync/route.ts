// POST /api/shopify/sync
//
// Triggers a Shopify bulk sync (customers + products) for one store. Runs async on
// the server; the UI polls via GET /api/shopify/sync/status?storeSlug=... for progress.
//
// Body: { storeSlug: string, what?: "customers" | "products" | "both" (default both) }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncStoreCustomers, type SyncProgress } from "@/lib/sync/shopify-customers";
import { syncStoreProducts, type ProductSyncProgress } from "@/lib/sync/shopify-products";

// In-memory progress map. For a multi-instance deployment this would live in Redis or
// a `SyncJob` table, but for the demo a single Vercel function holds onto progress fine.
const customerProgress = new Map<string, SyncProgress>();
const productProgress  = new Map<string, ProductSyncProgress>();

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { storeSlug, what = "both" } = await req.json().catch(() => ({} as { storeSlug?: string; what?: "customers" | "products" | "both" }));
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });

  // Kick off in background. We DON'T await — the function would time out on Vercel for
  // large stores. The caller polls /api/shopify/sync/status.
  const doCustomers = what === "customers" || what === "both";
  const doProducts  = what === "products"  || what === "both";

  if (doCustomers) {
    customerProgress.set(storeSlug, { storeSlug, fetched: 0, upserted: 0, skipped: 0, failed: 0, startedAt: Date.now() });
    syncStoreCustomers(storeSlug, (p) => customerProgress.set(storeSlug, p)).catch((e) => {
      const cur = customerProgress.get(storeSlug);
      if (cur) customerProgress.set(storeSlug, { ...cur, failed: cur.failed + 1, finishedAt: Date.now() });
      console.error("[shopify sync customers]", e);
    });
  }
  if (doProducts) {
    productProgress.set(storeSlug, { storeSlug, productsFetched: 0, variantsFetched: 0, upserted: 0, failed: 0, startedAt: Date.now() });
    syncStoreProducts(storeSlug, (p) => productProgress.set(storeSlug, p)).catch((e) => {
      const cur = productProgress.get(storeSlug);
      if (cur) productProgress.set(storeSlug, { ...cur, failed: cur.failed + 1, finishedAt: Date.now() });
      console.error("[shopify sync products]", e);
    });
  }

  return NextResponse.json({ ok: true, started: { customers: doCustomers, products: doProducts } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeSlug = url.searchParams.get("storeSlug");
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    customers: customerProgress.get(storeSlug) ?? null,
    products:  productProgress.get(storeSlug) ?? null,
  });
}
