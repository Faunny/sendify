// POST /api/promotions/webhook
//
// Receives promotion upserts from the user's upstream marketing-calendar project.
// The upstream tool owns the calendar source-of-truth; Sendify mirrors it and (optionally)
// kicks off an auto-draft when a promotion lands in the lead-time window.
//
// Auth: HMAC-SHA256 signature over the raw body, sent in `X-Sendify-Signature`.
// Idempotency: keyed on `externalId` (required) + `externalSource` (recommended).
//
// Contract (request body):
// {
//   "externalId": "promo_2026_madres_es",         // required, unique in upstream system
//   "externalSource": "marketing-calendar",        // free-form
//   "action": "upsert" | "delete",                 // default: upsert
//   "name": "Día de la Madre",
//   "kind": "REGIONAL" | "GLOBAL" | "STORE",
//   "dateByCountry": { "ES": "2026-05-03", "MX": "2026-05-10", ... },
//   "storeId": "st_1",                              // optional; null = applies to all stores
//   "autoDraft": true,
//   "leadDays": 14,
//   "defaultSegmentIds": ["sg_1"],
//   "bannerPrompt": "Elegant mother's day banner …",
//   "briefForLlm": "Focus on top 3 women's florals. Spend €25-30. Tone warm.",
//   "copyByLang": { "es-ES": { "subject": "…", "hero": "…" } }
// }

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

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

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const secret = process.env.PROMOTIONS_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.replace(/^sha256=/, ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-sendify-signature");

  // In dev (no secret configured) we skip the check so it's easy to test with curl.
  // In prod set PROMOTIONS_WEBHOOK_SECRET and the upstream sender computes the HMAC.
  if (process.env.PROMOTIONS_WEBHOOK_SECRET && !verifySignature(raw, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (!body.externalId || !body.name || !body.kind || !body.dateByCountry) {
    return NextResponse.json({ ok: false, error: "missing required fields" }, { status: 400 });
  }

  // Production: upsert in Prisma:
  //   await prisma.promotion.upsert({
  //     where: { externalId: body.externalId },
  //     update: { ... },
  //     create: { ... },
  //   });
  // And, if `autoDraft` is true and any market's lead-time has begun, enqueue a draft job.

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    externalId: body.externalId,
    action: body.action ?? "upsert",
    note: "dev mode: not persisted",
  });
}
