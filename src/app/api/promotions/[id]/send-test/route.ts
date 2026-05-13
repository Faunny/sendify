// POST /api/promotions/[id]/send-test
//
// End-to-end: take an existing Promotion, build a brief from its name + copy,
// run the full AI generator (medium quality + real product reference), save as
// a Template, render MJML → HTML, send via SES to the requested email.
//
// Used by the "Plan E" sprint: from a single promotion in Neon, get a fully-
// rendered email in the user's inbox in one click.
//
// Body: { to, storeSlug?, language? }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTemplate } from "@/lib/ai/generate-template";
import { renderMjml } from "@/lib/mjml";
import { sendEmail } from "@/lib/ses";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const to = String(body.to ?? "").trim().toLowerCase();
  const explicitStore = (body.storeSlug as string | undefined) ?? "divain-europa";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "valid 'to' email required" }, { status: 400 });
  }

  const promo = await prisma.promotion.findUnique({
    where: { id },
    select: { id: true, name: true, kind: true, dateByCountry: true, briefForLlm: true, copyByLang: true, storeId: true },
  });
  if (!promo) return NextResponse.json({ ok: false, error: "promotion not found" }, { status: 404 });

  // Build the brief: promo name + any copyByLang metadata + discount hints.
  const meta = (promo.copyByLang as Record<string, unknown> | null)?._meta as Record<string, unknown> | undefined;
  const discountKind  = meta?.discountKind as string | undefined;
  const discountValue = meta?.discountValue as string | number | undefined;
  const briefParts: string[] = [
    `${promo.name} · campaña para divain · tono editorial`,
  ];
  if (discountKind && discountValue) briefParts.push(`Tipo de descuento: ${discountKind} · valor: ${discountValue}`);
  if (promo.briefForLlm) briefParts.push(promo.briefForLlm);
  const brief = briefParts.join(". ");

  // Resolve store — use promo's storeId if set, otherwise the explicit one.
  let storeSlug = explicitStore;
  if (promo.storeId) {
    const s = await prisma.store.findUnique({ where: { id: promo.storeId }, select: { slug: true } }).catch(() => null);
    if (s) storeSlug = s.slug;
  }

  // 1) Generate the full email — medium quality + real product reference.
  let generated;
  try {
    generated = await generateTemplate({
      brief,
      pillar: "PARFUMS",
      storeSlug,
      tone: /flash|24h|urg|black/i.test(promo.name) ? "urgente-flash" : "comercial-directo",
      imageQuality: "medium",
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "generate",
      error: e instanceof Error ? e.message : "generation failed",
    }, { status: 502 });
  }

  // 2) Persist as Template row so it's findable later in /templates.
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  const template = await prisma.template.create({
    data: { storeId: store?.id ?? null, name: `${promo.name} · ${storeSlug}`, kind: "CAMPAIGN", mjml: generated.mjml },
    select: { id: true },
  });

  // 3) Compile MJML.
  const compiled = renderMjml(generated.mjml);
  if (!compiled.html) {
    return NextResponse.json({
      ok: false,
      stage: "render",
      templateId: template.id,
      error: `MJML compile produced no html · ${compiled.errors.slice(0, 3).join(" · ")}`,
    }, { status: 500 });
  }

  // 4) Send via SES.
  const sender = store
    ? await prisma.sender.findFirst({ where: { storeId: store.id }, select: { fromEmail: true, fromName: true } })
    : null;
  const from = sender ? `${sender.fromName} <${sender.fromEmail}>` : (process.env.SENDIFY_FROM_EMAIL ?? "divain@divainparfums.com");

  try {
    const r = await sendEmail({
      from,
      to,
      subject: generated.subject,
      html: compiled.html,
      tags: [
        { name: "promo", value: promo.id },
        { name: "template", value: template.id },
      ],
    });
    return NextResponse.json({
      ok: true,
      stage: "sent",
      templateId: template.id,
      promotionId: promo.id,
      promotionName: promo.name,
      subject: generated.subject,
      layoutPattern: generated.layoutPattern,
      modelUsed: generated.modelUsed,
      bannerUrl: generated.bannerUrl,
      bannerError: generated.bannerError,
      from,
      to,
      messageId: r.messageId,
      sentAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "send",
      templateId: template.id,
      error: e instanceof Error ? e.message.slice(0, 320) : "SES send failed",
    }, { status: 502 });
  }
}
