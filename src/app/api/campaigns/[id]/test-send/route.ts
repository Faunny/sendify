// POST /api/campaigns/[id]/test-send
//
// Sends one rendered email for this campaign to a single recipient (typically the admin
// who's reviewing). Uses the campaign's store + sender + language. Doesn't write a Send
// row — test sends are out-of-band and don't count toward the audience ledger.
//
// Body: { email: string, language?: string }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/ses";
import { renderMjml, personalize } from "@/lib/mjml";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { email, language } = await req.json().catch(() => ({} as { email?: string; language?: string }));
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      store: true,
      sender: true,
      variants: { where: language ? { language } : undefined, take: 1 },
    },
  });
  if (!campaign) return NextResponse.json({ ok: false, error: "campaign not found" }, { status: 404 });
  if (!campaign.sender) {
    return NextResponse.json(
      { ok: false, error: "Esta campaña no tiene sender. Asigna uno en /settings antes de enviar." },
      { status: 400 },
    );
  }

  // Pick a variant: requested language, or store default, or any first variant.
  const variant = campaign.variants[0] ?? (await prisma.campaignVariant.findFirst({
    where: { campaignId: id, language: campaign.store.defaultLanguage },
  })) ?? (await prisma.campaignVariant.findFirst({ where: { campaignId: id } }));
  if (!variant) {
    return NextResponse.json(
      { ok: false, error: "no variants yet — aprueba la campaña primero para generar las variantes traducidas" },
      { status: 400 },
    );
  }

  // Compile MJML → HTML (use the snapshot if it exists, otherwise compile now)
  let html = variant.htmlSnapshot;
  if (!html) {
    const { html: compiled, errors } = renderMjml(variant.mjml);
    if (errors.length > 0) console.warn("[test-send] mjml warnings:", errors);
    html = compiled;
  }
  html = personalize(html, {
    first_name: "(test)",
    last_name: "",
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?t=${encodeURIComponent(email)}&test=1`,
  });

  try {
    const result = await sendEmail({
      from: `${campaign.sender.fromName} <${campaign.sender.fromEmail}>`,
      to: email,
      subject: `[TEST] ${variant.subject}`,
      html,
      configurationSet: process.env.SES_CONFIGURATION_SET,
      tags: [
        { name: "campaign_id", value: id },
        { name: "language", value: variant.language },
        { name: "is_test", value: "true" },
      ],
    });
    return NextResponse.json({ ok: true, messageId: result.messageId, language: variant.language });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    // SES not yet configured? Surface that cleanly so the UI shows the right hint.
    if (/AWS_ACCESS_KEY|signature|UnrecognizedClient|sender.+verified/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "AWS SES no está configurado todavía · pega AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY como env vars en Vercel y verifica el dominio sender en SES" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
