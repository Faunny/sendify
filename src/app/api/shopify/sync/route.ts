// POST /api/shopify/sync
//
// Runs a Shopify bulk sync (customers + products) for one store SYNCHRONOUSLY,
// up to ~45 s wall-clock per call (Hobby caps the function at 60 s; Pro at 300 s).
// The response carries the full progress + a `hasMore` flag — the UI keeps
// hitting the endpoint until `hasMore` is false. No background work, no polling
// — survives Vercel cold starts and reports OAuth / network errors as they happen.
//
// Body: { storeSlug: string, what?: "customers" | "products" | "both" (default both) }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncStoreCustomers } from "@/lib/sync/shopify-customers";
import { syncStoreProducts } from "@/lib/sync/shopify-products";

// Neon's free tier auto-suspends compute after ~5 min of inactivity. The first
// query after a cold-start often fails before Prisma's default timeout. Retry
// with exponential backoff so the user never sees a "can't reach database" error
// when really Neon is just waking back up (typical wake time: 1-3 seconds).
async function waitForDb(maxAttempts = 6): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      const delay = Math.min(500 * 2 ** i, 4000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Final attempt — let the real error propagate to the response so the user
  // sees a meaningful message instead of a silent stall.
  await prisma.$queryRaw`SELECT 1`;
}

export const maxDuration = 60; // Hobby ceiling — we stop syncing internally at 45s.
export const dynamic = "force-dynamic";

const BUDGET_MS = 45_000;

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { storeSlug, what = "both" } = await req.json().catch(() => ({} as { storeSlug?: string; what?: "customers" | "products" | "both" }));
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });

  // Wake Neon up front so the credential read inside the sync helpers doesn't
  // race against a cold compute and explode with "Can't reach database server".
  try {
    await waitForDb();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Database aún arrancando (Neon free tier). Vuelve a darle a "Sync now" en 5 segundos. Detalle: ${e instanceof Error ? e.message : "db unreachable"}`,
    }, { status: 503 });
  }

  const doCustomers = what === "customers" || what === "both";
  const doProducts  = what === "products"  || what === "both";

  let customers = null;
  let products = null;
  let firstError: string | null = null;

  // Split budget if doing both, otherwise give all of it to whichever was requested.
  const customerBudget = doProducts ? BUDGET_MS * 0.6 : BUDGET_MS;
  const productBudget  = doCustomers ? BUDGET_MS * 0.4 : BUDGET_MS;

  if (doCustomers) {
    try {
      customers = await syncStoreCustomers(storeSlug, undefined, { budgetMs: customerBudget });
    } catch (e) {
      firstError = e instanceof Error ? e.message : "customer sync failed";
      console.error("[shopify sync customers]", e);
    }
  }
  if (doProducts) {
    try {
      products = await syncStoreProducts(storeSlug, undefined, { budgetMs: productBudget });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "product sync failed";
      console.error("[shopify sync products]", e);
      if (!firstError) firstError = msg;
    }
  }

  return NextResponse.json({
    ok: !firstError,
    error: firstError,
    customers,
    products,
  });
}

// GET kept for backward-compat with the polling UI — but the POST response is now
// authoritative, so we just return whatever was last seen on this instance (best-
// effort) or null.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeSlug = url.searchParams.get("storeSlug");
  if (!storeSlug) return NextResponse.json({ ok: false, error: "missing storeSlug" }, { status: 400 });
  return NextResponse.json({ ok: true, customers: null, products: null });
}
