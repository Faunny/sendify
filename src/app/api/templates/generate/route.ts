// POST /api/templates/generate
//
// Generates a complete email template (subject + preheader + MJML) from a short
// brief, using whichever LLM is configured (DeepSeek preferred, OpenAI fallback).
// Persists the result to a Template row and returns its id so the UI can redirect
// to /builder?templateId=…
//
// Body: { brief: string, pillar: "PARFUMS"|"CARE"|"HOME"|"RITUAL"|"ALL", storeSlug?, tone?, name? }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTemplate, type TemplateGenInput } from "@/lib/ai/generate-template";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Partial<TemplateGenInput & { name?: string }>));
  const brief = String(body.brief ?? "").trim();
  if (brief.length < 8) {
    return NextResponse.json({ ok: false, error: "El brief es demasiado corto · describe el evento, audiencia y tono" }, { status: 400 });
  }
  const pillar  = (body.pillar  ?? "PARFUMS") as TemplateGenInput["pillar"];
  const tone    = body.tone     ?? "editorial-warm";
  const storeSlug = body.storeSlug;
  const name    = body.name?.trim() || `${pillar} · ${brief.slice(0, 40)}${brief.length > 40 ? "…" : ""}`;

  let generated;
  try {
    generated = await generateTemplate({ brief, pillar, storeSlug, tone });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "AI generation failed",
    }, { status: 502 });
  }

  // Persist as a Template row. storeId stays null = global template until the user
  // attaches it to a campaign for a specific store.
  let templateId: string | null = null;
  try {
    const store = storeSlug ? await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } }) : null;
    const row = await prisma.template.create({
      data: {
        storeId: store?.id ?? null,
        name,
        kind: "CAMPAIGN",
        mjml: generated.mjml,
      },
    });
    templateId = row.id;
  } catch (e) {
    // Generation succeeded but DB save failed — still return the generated content so
    // the user can copy/paste it manually.
    return NextResponse.json({
      ok: true,
      warning: `Generación OK pero no se pudo guardar en DB: ${e instanceof Error ? e.message : "db error"}`,
      subject: generated.subject,
      preheader: generated.preheader,
      mjml: generated.mjml,
      modelUsed: generated.modelUsed,
    });
  }

  return NextResponse.json({
    ok: true,
    templateId,
    subject: generated.subject,
    preheader: generated.preheader,
    mjml: generated.mjml,
    modelUsed: generated.modelUsed,
    tokensIn:  generated.promptTokens,
    tokensOut: generated.completionTokens,
  });
}
