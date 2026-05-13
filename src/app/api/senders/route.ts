// POST /api/senders     — create a new sender identity and start SES verification
// GET  /api/senders     — list senders (used by the "Add sender" dialog)
//
// Body for create:
//   { fromEmail, fromName, storeSlug, replyToEmail?, dailyCap? }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCredential } from "@/lib/credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const senders = await prisma.sender.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, fromEmail: true, fromName: true, verified: true, store: { select: { name: true, slug: true } } },
  });
  return NextResponse.json({ ok: true, senders });
}

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const fromEmail = String(body.fromEmail ?? "").trim().toLowerCase();
  const fromName  = String(body.fromName  ?? "").trim();
  const storeSlug = String(body.storeSlug ?? "").trim();
  const replyToEmail = (body.replyToEmail ? String(body.replyToEmail).trim() : null) as string | null;
  const dailyCap = typeof body.dailyCap === "number" ? body.dailyCap : 1000;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) return NextResponse.json({ ok: false, error: "valid fromEmail required" }, { status: 400 });
  if (!fromName)  return NextResponse.json({ ok: false, error: "fromName required" }, { status: 400 });
  if (!storeSlug) return NextResponse.json({ ok: false, error: "storeSlug required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 400 });

  const sender = await prisma.sender.create({
    data: {
      storeId: store.id,
      provider: "SES",
      fromEmail,
      fromName,
      replyToEmail,
      dailyCap,
      verified: false,
    },
    select: { id: true, fromEmail: true, fromName: true },
  });

  // Best-effort: ask SES to start the domain verification for the sender's domain.
  // The user still has to paste the returned DNS records into their DNS provider.
  let dkimTokens: string[] = [];
  try {
    const cred = await getCredential("AWS_SES");
    if (cred) {
      const region = (cred.meta?.region as string | undefined) ?? "eu-west-1";
      const secret = (cred.meta?.secret as string | undefined);
      if (secret) {
        const { SESv2Client, CreateEmailIdentityCommand, GetEmailIdentityCommand } = await import("@aws-sdk/client-sesv2");
        const client = new SESv2Client({ region, credentials: { accessKeyId: cred.value, secretAccessKey: secret } });
        const domain = fromEmail.split("@")[1];
        // CreateEmailIdentity is idempotent: if the domain is already there it
        // throws AlreadyExistsException — we then just fetch its tokens.
        try {
          await client.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }));
        } catch (e) {
          if (!(e instanceof Error) || !/already exists/i.test(e.message)) throw e;
        }
        const r = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
        dkimTokens = r.DkimAttributes?.Tokens ?? [];
      }
    }
  } catch (e) {
    console.warn("[senders] SES verification setup failed:", e);
  }

  return NextResponse.json({ ok: true, sender, dkimTokens });
}
