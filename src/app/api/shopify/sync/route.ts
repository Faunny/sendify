// POST /api/shopify/sync
//
// Triggers a Shopify bulk sync (customers + products) for one store. Runs async on
// the server; the UI polls via GET /api/shopify/sync/status?storeSlug=... for progress.
//
// Body: { storeSlug: string, what?: "customers" | "products" | "both" (default both) }

import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { syncStoreCustomers, type SyncProgress } from "@/lib/sync/shopify-customers";
import { syncStoreProducts, type ProductSyncProgress } from "@/lib/sync/shopify-products";

// Vercel serverless terminates the function after the response is sent, so a
// fire-and-forget .catch() chain gets killed mid-sync. `after()` from Next.js 15
// keeps the function alive until the registered work resolves (up to the route's
// maxDuration limit).
export const maxDuration = 300; // 5 min — Pro plan ceiling; Hobby caps at 60s

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
    after(async () => {
      try {
        await syncStoreCustomers(storeSlug, (p) => customerProgress.set(storeSlug, p));
      } catch (e) {
        const cur = customerProgress.get(storeSlug);
        const msg = e instanceof Error ? e.message : "sync failed";
        if (cur) customerProgress.set(storeSlug, { ...cur, failed: cur.failed + 1, finishedAt: Date.now(), error: msg } as SyncProgress & { error: string });
        console.error("[shopify sync customers]", e);
      }
    });
  }
  if (doProducts) {
    productProgress.set(storeSlug, { storeSlug, productsFetched: 0, variantsFetched: 0, upserted: 0, failed: 0, startedAt: Date.now() });
    after(async () => {
      try {
        await syncStoreProducts(storeSlug, (p) => productProgress.set(storeSlug, p));
      } catch (e) {
        const cur = productProgress.get(storeSlug);
        const msg = e instanceof Error ? e.message : "sync failed";
        if (cur) productProgress.set(storeSlug, { ...cur, failed: cur.failed + 1, finishedAt: Date.now(), error: msg } as ProductSyncProgress & { error: string });
        console.error("[shopify sync products]", e);
      }
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
