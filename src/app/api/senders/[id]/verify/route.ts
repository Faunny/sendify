// POST /api/senders/[id]/verify
//
// Re-check the sender's DNS verification status against AWS SES and update
// the Sender row accordingly. Used by the "Refresh" button on the Configure
// dialog so the user can see whether the DNS records they pasted have
// propagated yet.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const sender = await prisma.sender.findUnique({ where: { id }, select: { id: true, fromEmail: true } });
  if (!sender) return NextResponse.json({ ok: false, error: "sender not found" }, { status: 404 });

  const cred = await getCredential("AWS_SES");
  if (!cred) return NextResponse.json({ ok: false, error: "AWS SES not configured in Settings → Integrations" }, { status: 400 });

  const region = (cred.meta?.region as string | undefined) ?? "eu-west-1";
  const secret = (cred.meta?.secret as string | undefined);
  if (!secret) return NextResponse.json({ ok: false, error: "SES secret missing in credential meta" }, { status: 500 });

  try {
    const { SESv2Client, GetEmailIdentityCommand } = await import("@aws-sdk/client-sesv2");
    const client = new SESv2Client({ region, credentials: { accessKeyId: cred.value, secretAccessKey: secret } });
    const domain = sender.fromEmail.split("@")[1] ?? sender.fromEmail;
    const r = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));

    const verified = r.VerifiedForSendingStatus === true;
    const dkim = r.DkimAttributes?.Status === "SUCCESS";
    // Persist a tiny status snapshot we can display next to the badge.
    await prisma.sender.update({
      where: { id: sender.id },
      data: { verified },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      verified,
      dkim,
      dkimTokens: r.DkimAttributes?.Tokens ?? [],
      mailFromDomain: r.MailFromAttributes?.MailFromDomain ?? null,
      mailFromStatus: r.MailFromAttributes?.MailFromDomainStatus ?? null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 280) : "SES check failed",
    }, { status: 502 });
  }
}
