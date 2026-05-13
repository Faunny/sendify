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
import { getCredential } from "@/lib/credentials";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type Payload = {
  externalId: string;
  externalSource?: string;
  action?: "upsert" | "delete";
  name: string;
  kind: "REGIONAL" | "GLOBAL" | "STORE";
  dateByCountry: Record<string, string>;
  storeId?: string;
  autoDraft?: boolean;
  leadDays?: number;
  defaultSegmentIds?: string[];
  bannerPrompt?: string;
  briefForLlm?: string;
  copyByLang?: Record<string, Record<string, string>>;
};

async function getWebhookSecret(): Promise<string | null> {
  // Prefer the secret saved through Settings (encrypted in DB). Fall back to the
  // raw env var so existing setups keep working.
  const cred = await getCredential("PROMOTIONS_WEBHOOK_SECRET").catch(() => null);
  if (cred?.value) return cred.value;
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

  const secret = await getWebhookSecret();
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
  let storeId: string | null = null;
  if (body.storeId) {
    // Accept either a slug or a real id — easier for the upstream project.
    const store = await prisma.store.findFirst({
      where: { OR: [{ id: body.storeId }, { slug: body.storeId }] },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json({ ok: false, error: `storeId "${body.storeId}" not found (use the cuid or the slug)` }, { status: 400 });
    }
    storeId = store.id;
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
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 300) : "db upsert failed",
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
    syncedAt: new Date().toISOString(),
  });
}

// GET — useful for quick health-check from the upstream project's UI:
//   GET /api/promotions/webhook  →  { ok, configured, count }
export async function GET() {
  const secret = await getWebhookSecret();
  const count = await prisma.promotion.count({ where: { active: true } }).catch(() => 0);
  return NextResponse.json({
    ok: true,
    endpoint: "promotions webhook",
    secretConfigured: !!secret,
    activePromotions: count,
  });
}
