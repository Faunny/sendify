// POST /api/templates/test-send-preview
//
// Save an AI-generated preview as a Template row AND send a test email to the
// admin's inbox via SES in one shot. Used by the "Guardar y enviar prueba"
// button on the sample-pack dialog so the user can validate the actual
// rendered email in their own inbox (not just the iframe preview).
//
// Body:
//   { name, subject, preheader, mjml, storeSlug?, to }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderMjml } from "@/lib/mjml";
import { sendEmail } from "@/lib/ses";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name      = String(body.name      ?? "").trim() || `Preview · ${new Date().toISOString().slice(0, 10)}`;
  const subject   = String(body.subject   ?? "").trim();
  const preheader = String(body.preheader ?? "").trim();
  const mjml      = String(body.mjml      ?? "").trim();
  const storeSlug = (body.storeSlug ?? null) as string | null;
  const to        = String(body.to ?? "").trim().toLowerCase();

  if (!subject || !mjml) {
    return NextResponse.json({ ok: false, error: "subject + mjml required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "valid 'to' email required" }, { status: 400 });
  }

  // 1. Persist as a Template row so the user can find it later in /templates.
  const store = storeSlug
    ? await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } })
    : null;

  let template;
  try {
    template = await prisma.template.create({
      data: { storeId: store?.id ?? null, name, kind: "CAMPAIGN", mjml },
      select: { id: true, name: true },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "template save failed",
    }, { status: 500 });
  }

  // 2. Compile MJML → HTML right now.
  const compiled = renderMjml(mjml);
  if (!compiled.html) {
    return NextResponse.json({
      ok: false,
      error: `MJML compile produced no html · ${compiled.errors.slice(0, 3).join(" · ")}`,
      templateId: template.id,
    }, { status: 500 });
  }

  // 3. Pick a sender. Prefer a verified sender on the target store; fall back to
  //    the generic SENDIFY_FROM_EMAIL env (divain@divainparfums.com).
  const sender = store
    ? await prisma.sender.findFirst({
        where: { storeId: store.id, verified: true },
        select: { fromEmail: true, fromName: true },
      })
    : null;
  const from = sender
    ? `${sender.fromName} <${sender.fromEmail}>`
    : (process.env.SENDIFY_FROM_EMAIL ?? "divain@divainparfums.com");

  // 4. Send via SES.
  try {
    const result = await sendEmail({
      from,
      to,
      subject: preheader ? `${subject} — ${preheader.slice(0, 80)}` : subject,
      html: compiled.html,
      tags: [
        { name: "type", value: "preview" },
        { name: "template", value: template.id },
      ],
    });
    return NextResponse.json({
      ok: true,
      templateId: template.id,
      messageId: result.messageId,
      from,
      to,
      sentAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      templateId: template.id,
      error: e instanceof Error ? e.message.slice(0, 320) : "SES send failed",
    }, { status: 502 });
  }
}
