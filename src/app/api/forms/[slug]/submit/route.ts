// POST /api/forms/[slug]/submit
//
// Public endpoint — receives a form submission from the embed snippet, upserts
// the Customer (consentStatus depends on doubleOptIn config), records the raw
// submission, and returns the success message / redirect.
//
// CORS-open so the embed JS can POST from any divain storefront.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ConsentStatus, type Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({
    where: { slug },
    select: {
      id: true, storeId: true, status: true, fields: true,
      behavior: true, tagsOnSubmit: true, segmentIds: true,
      store: { select: { id: true, defaultLanguage: true } },
    },
  });
  if (!form || form.status !== "PUBLISHED") {
    return NextResponse.json({ ok: false, error: "form not found or unpublished" }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400, headers: CORS_HEADERS });
  }

  const behavior = (form.behavior ?? {}) as { doubleOptIn?: boolean; successMessage?: string; successRedirectUrl?: string | null };
  const fields   = (form.fields   ?? []) as Array<{ id: string; type: string; required?: boolean }>;
  const consentField = fields.find((f) => f.type === "consent");
  const hasConsent = consentField ? Boolean(body[consentField.id]) : true;
  if (consentField?.required && !hasConsent) {
    return NextResponse.json({ ok: false, error: "consent required" }, { status: 400, headers: CORS_HEADERS });
  }

  const firstName = (body.firstName ?? body.name ?? null) as string | null;
  const lastName  = (body.lastName  ?? null) as string | null;
  const phone     = (body.phone     ?? null) as string | null;

  const consentStatus: ConsentStatus = behavior.doubleOptIn === true
    ? ConsentStatus.PENDING        // upgraded to SUBSCRIBED once they click the magic link
    : ConsentStatus.SUBSCRIBED;

  // Persist the raw submission first — survives even if the customer upsert fails.
  await prisma.formSubmission.create({
    data: {
      formId: form.id,
      storeId: form.storeId,
      email,
      fieldData: body as Prisma.InputJsonValue,
      source: req.headers.get("referer"),
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    },
  }).catch(() => {});

  // Upsert the customer if this form is scoped to a store. Forms not tied to a
  // store skip the upsert (submission still recorded so we don't lose data).
  let customerId: string | undefined;
  if (form.storeId) {
    const data = {
      storeId: form.storeId,
      shopifyId: `form:${form.id}:${email}`,  // synthetic id since we don't know Shopify's
      email,
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      country: null,
      language: form.store?.defaultLanguage ?? "es-ES",
      acceptsMarketing: hasConsent,
      consentStatus,
      hasApp: false,
      totalSpent: 0,
      ordersCount: 0,
      tags: form.tagsOnSubmit ?? [],
      shopifyTags: [],
    } satisfies Prisma.CustomerUncheckedCreateInput;

    try {
      const cust = await prisma.customer.upsert({
        where: { storeId_shopifyId: { storeId: form.storeId, shopifyId: data.shopifyId } },
        create: data,
        update: {
          firstName: firstName ?? undefined,
          lastName:  lastName  ?? undefined,
          phone:     phone     ?? undefined,
          acceptsMarketing: hasConsent,
          consentStatus,
          tags: { set: Array.from(new Set([...(form.tagsOnSubmit ?? [])])) },
        },
      });
      customerId = cust.id;
      await prisma.formSubmission.updateMany({
        where: { formId: form.id, email, customerId: null },
        data:  { customerId },
      });
    } catch {
      // Already in submissions table — fail soft so the public form doesn't 500.
    }
  }

  // Bump impressions/submissions counters (denormalized).
  await prisma.form.update({
    where: { id: form.id },
    data: { submissions: { increment: 1 } },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    customerId,
    successMessage: behavior.successMessage ?? "¡Gracias!",
    redirect: behavior.successRedirectUrl ?? null,
  }, { headers: CORS_HEADERS });
}
