// POST /api/promotions/webhook
//
// Receives promotion upserts from the user's upstream marketing-calendar project.
// The upstream tool owns the calendar source-of-truth; Sendify mirrors it and
// (optionally) auto-drafts when a market's lead window has opened.
//
// Auth: HMAC-SHA256 signature over the raw body, sent in `X-Sendify-Signature`.
// Idempotency: keyed on `externalId` (required) + `externalSource` (recommended).
//
// Contract (request body):
// {
//   "externalId":      "promo_2026_madres_es",     // required, unique in upstream
//   "externalSource":  "marketing-calendar",
//   "action":          "upsert" | "delete",         // default: upsert
//   "name":            "Día de la Madre",
//   "kind":            "REGIONAL" | "GLOBAL" | "STORE",
//   "dateByCountry":   { "ES": "2026-05-03", "MX": "2026-05-10", ... },
//   "storeId":         "st_1",                       // optional; null = all stores
//   "autoDraft":       true,
//   "leadDays":        14,
//   "defaultSegmentIds": ["sg_1"],
//   "bannerPrompt":    "...",
//   "briefForLlm":     "...",
//   "copyByLang":      { "es-ES": { "subject": "…" } }
// }

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // Neon cold-start + upsert headroom

type Payload = {
  externalId: string;
  externalSource?: string;
  action?: "upsert" | "delete";
  name: string;
  kind: "REGIONAL" | "GLOBAL" | "STORE";
  dateByCountry: Record<string, string>;
  // Store identifier — accept any of these field names + any of these value
  // formats so the upstream project doesn't have to match Sendify's internal
  // schema exactly: full slug ("divain-europa") · short code ("eu") · cuid · null.
  storeId?: string;
  store?: string;
  storeSlug?: string;
  shopDomain?: string;
  autoDraft?: boolean;
  leadDays?: number;
  defaultSegmentIds?: string[];
  bannerPrompt?: string;
  briefForLlm?: string;
  copyByLang?: Record<string, Record<string, string>>;
};

// Resolve a flexible store identifier to a Store.id. Accepts:
//   - cuid  (the real id)
//   - full slug ("divain-europa", "divain-uk", "divain-na", "divain-mx")
//   - short code: "eu" | "europa" | "uk" | "gb" | "na" | "us" | "usa" | "mx" | "mexico"
//   - shopifyDomain ("divaines.myshopify.com")
// Returns null when nothing matches.
async function resolveStoreId(raw: string | undefined | null): Promise<{ id: string; slug: string } | null> {
  if (!raw) return null;
  const v = raw.toString().trim().toLowerCase();

  const SHORT_CODES: Record<string, string> = {
    "eu": "divain-europa",     "europa": "divain-europa",
    "uk": "divain-uk",         "gb":     "divain-uk",
    "na": "divain-na",         "us":     "divain-na",  "usa": "divain-na",
    "mx": "divain-mx",         "mexico": "divain-mx",  "méxico": "divain-mx",
  };
  const candidate = SHORT_CODES[v] ?? raw;

  const store = await prisma.store.findFirst({
    where: {
      OR: [
        { id: candidate },
        { id: raw },
        { slug: candidate },
        { slug: raw },
        { shopifyDomain: raw },
      ],
    },
    select: { id: true, slug: true },
  }).catch(() => null);

  return store;
}

function getWebhookSecret(): string | null {
  // Read straight from env. We deliberately do NOT consult the DB here — this
  // route is hit by an external system that doesn't tolerate latency from a
  // Neon cold-start, and verifying a single signature must be near-instant.
  return process.env.PROMOTIONS_WEBHOOK_SECRET ?? null;
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.replace(/^sha256=/, ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-sendify-signature");

  const secret = getWebhookSecret();
  // If no secret is configured at all, allow the request through (bootstrap mode).
  // Once a secret is set, every request must pass HMAC verification.
  if (secret) {
    if (!verifySignature(raw, sig, secret)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }
  }

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!body.externalId || !body.name || !body.kind || !body.dateByCountry) {
    return NextResponse.json({ ok: false, error: "missing required fields (externalId, name, kind, dateByCountry)" }, { status: 400 });
  }

  // ── DELETE path
  if (body.action === "delete") {
    try {
      await prisma.promotion.update({
        where: { externalId: body.externalId },
        data:  { active: false },
      });
      return NextResponse.json({ ok: true, action: "delete", externalId: body.externalId });
    } catch {
      return NextResponse.json({ ok: true, action: "delete", externalId: body.externalId, note: "not found, ignored" });
    }
  }

  // ── UPSERT path
  // Accept the store identifier under any of these field names. First defined
  // wins; null means "applies to all stores" which is also a valid choice.
  const storeInput = body.storeId ?? body.store ?? body.storeSlug ?? body.shopDomain ?? null;
  let storeId: string | null = null;
  let resolvedSlug: string | null = null;
  if (storeInput) {
    const store = await resolveStoreId(storeInput);
    if (!store) {
      return NextResponse.json({
        ok: false,
        error: `store "${storeInput}" not recognized. Accepted: cuid, slug (divain-europa | divain-uk | divain-na | divain-mx), short code (eu | uk | na | mx), or shopifyDomain.`,
      }, { status: 400 });
    }
    storeId = store.id;
    resolvedSlug = store.slug;
  }

  const data: Prisma.PromotionUncheckedCreateInput = {
    storeId,
    name: body.name,
    kind: body.kind,
    dateByCountry: body.dateByCountry as Prisma.InputJsonValue,
    copyByLang: body.copyByLang as Prisma.InputJsonValue | undefined,
    externalId: body.externalId,
    externalSource: body.externalSource ?? "webhook",
    autoDraft: body.autoDraft ?? true,
    leadDays: body.leadDays ?? 14,
    defaultSegmentIds: body.defaultSegmentIds ?? [],
    bannerPrompt: body.bannerPrompt ?? null,
    briefForLlm: body.briefForLlm ?? null,
    active: true,
  };

  let promotion;
  try {
    promotion = await prisma.promotion.upsert({
      where: { externalId: body.externalId },
      create: data,
      update: {
        name: data.name,
        kind: data.kind,
        dateByCountry: data.dateByCountry,
        copyByLang: data.copyByLang,
        autoDraft: data.autoDraft,
        leadDays: data.leadDays,
        defaultSegmentIds: data.defaultSegmentIds,
        bannerPrompt: data.bannerPrompt,
        briefForLlm: data.briefForLlm,
        active: true,
      },
    });
  } catch (e) {
    // Surface the actual cause to the upstream sender + log to Vercel so we can
    // grep when 50 retries hit. Prisma errors are most useful from the tail.
    const msg = e instanceof Error ? e.message : "db upsert failed";
    console.error("[promotions webhook] upsert failed", {
      externalId: body.externalId, storeInput, resolvedStoreId: storeId, kind: body.kind, err: msg.slice(-500),
    });
    return NextResponse.json({
      ok: false,
      error: msg.slice(-500),
      debug: {
        externalId: body.externalId,
        storeInput,
        resolvedStoreId: storeId,
        resolvedSlug,
        kind: body.kind,
      },
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: "upsert",
    promotionId: promotion.id,
    externalId: promotion.externalId,
    name: promotion.name,
    autoDraft: promotion.autoDraft,
    leadDays: promotion.leadDays,
    storeSlug: resolvedSlug,
    syncedAt: new Date().toISOString(),
  });
}

// GET — health-check. Must respond in <3s even when Neon is cold, so we race
// the DB count against a timeout and return null rather than stalling.
export async function GET() {
  const secret = getWebhookSecret();
  const count = await Promise.race([
    prisma.promotion.count({ where: { active: true } }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ]);
  return NextResponse.json({
    ok: true,
    endpoint: "promotions webhook",
    method: "POST",
    coldStart: count === null,
    secretConfigured: !!secret,
    activePromotions: count,
  });
}
