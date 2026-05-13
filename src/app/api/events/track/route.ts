// POST /api/events/track
//
// Storefront pixel endpoint — Divain's Shopify theme calls this from JS on
// product views, checkout starts, etc., so flows like browse-abandonment can
// fire. Auth is loose because it's open-web; we identify by email cookie or
// explicit body param.
//
// Body shape:
//   { storeSlug: "divain-europa",
//     email: "buyer@example.com",
//     type: "browse" | "checkout_started",
//     productHandle?: "perfume-x",
//     productTitle?: "Perfume X",
//     productUrl?: "https://divainparfums.com/products/perfume-x",
//     productImageUrl?: "https://cdn..." }
//
// CORS is open on this route so the Shopify theme can call cross-origin.
// Rate-limit via the email+productHandle combo (best-effort dedupe).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrollIntoMatchingFlows } from "@/lib/flows/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug : null;
  const email     = typeof body.email === "string" ? body.email.toLowerCase().trim() : null;
  const type      = typeof body.type === "string" ? body.type : null;
  if (!storeSlug || !email || !type) {
    return NextResponse.json({ ok: false, error: "storeSlug + email + type required" }, { status: 400, headers: corsHeaders() });
  }

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404, headers: corsHeaders() });

  const customer = await prisma.customer.findFirst({
    where: { storeId: store.id, email, deletedAt: null },
    select: { id: true, consentStatus: true },
  });
  if (!customer) {
    // Unknown email — silently ignore. The pixel will only resolve known customers.
    return NextResponse.json({ ok: true, ignored: "customer not found" }, { headers: corsHeaders() });
  }

  // Record the event for analytics + flow eligibility.
  await prisma.customerEvent.create({
    data: {
      customerId: customer.id,
      type: type === "browse" ? "product.viewed" : type === "checkout_started" ? "checkout.started" : `pixel.${type}`,
      payload: body as unknown as object,
      occurredAt: new Date(),
    },
  }).catch(() => {});

  if (type === "browse") {
    // Browse-abandonment: enroll into matching active flows. Pass product info
    // into context so the email render can show what they were looking at.
    const r = await enrollIntoMatchingFlows({
      storeId: store.id,
      customerId: customer.id,
      trigger: "BROWSE_ABANDONMENT",
      context: {
        productHandle:   typeof body.productHandle === "string" ? body.productHandle : "",
        productTitle:    typeof body.productTitle === "string" ? body.productTitle : "",
        productUrl:      typeof body.productUrl === "string" ? body.productUrl : "",
        productImageUrl: typeof body.productImageUrl === "string" ? body.productImageUrl : "",
      },
    }).catch(() => ({ enrolled: 0, skipped: 0 }));
    return NextResponse.json({ ok: true, enrollment: r }, { headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
