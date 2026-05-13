// POST /api/templates/sample-pack
//
// Generates 4 sample templates — one per dominant layout pattern — using
// representative briefs, compiles each MJML to HTML, and returns them inline
// for preview. Nothing is persisted; this is a dry-run validator the user
// pulls up before approving the mass auto-plan run.
//
// Body: { storeSlug?: string } (defaults to divain-europa)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateTemplate } from "@/lib/ai/generate-template";
import { renderMjml } from "@/lib/mjml";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SAMPLE_BRIEFS: Array<{ id: string; label: string; brief: string; pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL"; tone: string }> = [
  {
    id: "mothers-day",
    label: "Día de la Madre — lifestyle hero",
    brief: "Día de la Madre · 15% off perfumes mujer · selección regalos · tono cálido y emocional · CTA descubrir la colección. discountKind=PERCENT, discountValue=15.",
    pillar: "PARFUMS",
    tone: "editorial-cálido",
  },
  {
    id: "black-friday",
    label: "Black Friday — big-number hero",
    brief: "Black Friday · 55% de descuento en TODA la colección · solo 24 horas · countdown · sin distracciones · 1 CTA gigante. discountKind=PERCENT, discountValue=55.",
    pillar: "ALL",
    tone: "urgente-flash",
  },
  {
    id: "gift-guide",
    label: "Guía regalos — product grid editorial",
    brief: "Guía de regalos de Navidad · curaduría de 4 fragancias unisex · packaging especial · sin urgencia · CTA ver guía. discountKind=NONE.",
    pillar: "PARFUMS",
    tone: "editorial-cálido",
  },
  {
    id: "ritual-launch",
    label: "Lanzamiento RITUAL — premium minimal",
    brief: "Lanzamiento set RITUAL edición verano · packaging exclusivo · 1 CTA · sin precio en el hero · estética lujo minimal · contemplativo. discountKind=NONE.",
    pillar: "RITUAL",
    tone: "lujo-minimalista",
  },
];

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as { storeSlug?: string }));
  const storeSlug = body.storeSlug ?? "divain-europa";

  // Run all 4 in parallel — each ~10-15s on GPT-4o, ~6-10s on DeepSeek. With
  // maxDuration=60s and 4-way parallel we comfortably fit.
  const results = await Promise.all(SAMPLE_BRIEFS.map(async (sample) => {
    try {
      const generated = await generateTemplate({
        brief: sample.brief,
        pillar: sample.pillar,
        storeSlug,
        tone: sample.tone,
      });
      const compiled = renderMjml(generated.mjml);
      return {
        id: sample.id,
        label: sample.label,
        ok: true as const,
        subject: generated.subject,
        preheader: generated.preheader,
        layoutPattern: generated.layoutPattern,
        bannerPrompt: generated.bannerPrompt,
        modelUsed: generated.modelUsed,
        mjml: generated.mjml,
        html: compiled.html,
        mjmlErrors: compiled.errors,
        tokensIn:  generated.promptTokens,
        tokensOut: generated.completionTokens,
      };
    } catch (e) {
      return {
        id: sample.id,
        label: sample.label,
        ok: false as const,
        error: e instanceof Error ? e.message.slice(-400) : "generation failed",
      };
    }
  }));

  return NextResponse.json({ ok: true, storeSlug, samples: results });
}
