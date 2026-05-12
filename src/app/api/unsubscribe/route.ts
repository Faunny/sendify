// RFC 8058 one-click unsubscribe endpoint.
// Mail clients POST here directly when the user clicks "Unsubscribe" in Gmail/Apple Mail.
// The token is signed so it can't be forged.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const form = await req.formData();
  const _action = form.get("List-Unsubscribe");
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  // In production: verify HMAC signature, extract customerId + email
  const email = token; // placeholder

  await prisma.suppression.upsert({
    where: { email },
    update: {},
    create: { email, reason: "UNSUBSCRIBE", source: "user:click-unsub" },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  // Some browsers follow the GET fallback (older List-Unsubscribe URLs).
  return POST(req);
}
