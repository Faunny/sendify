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

  const body = await req.json().catch(() => ({} as { storeSlug?: string; batch?: number }));
  const storeSlug = body.storeSlug ?? "divain-europa";
  // Hobby plan caps functions at 60s. 2 previews fit comfortably; the UI loops
  // a second call for the remaining pair.
  const batch = Math.max(0, Math.min(1, body.batch ?? 0));
  const batched = SAMPLE_BRIEFS.slice(batch * 2, batch * 2 + 2);

  // Run all 4 in parallel with a 350ms stagger so we don't slam the image
  // provider's rpm cap at the same instant. Each generation takes 15-35s
  // depending on whether the image provider routes to OpenAI or Gemini; the
  // wall-clock for the batch is ~max(individual) + (3 × 0.35s) ≈ 35s.
  const results = await Promise.all(batched.map(async (sample, i) => {
    if (i > 0) await new Promise((r) => setTimeout(r, i * 350));
    try {
      const generated = await generateTemplate({
        brief: sample.brief,
        pillar: sample.pillar,
        storeSlug,
        tone: sample.tone,
        // Previews use low quality to fit inside Vercel Hobby's 60s ceiling.
        // Model defaults to gpt-image-2 (auto-falls back to -1 on 404).
        imageQuality: "low",
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
        bannerUrl: generated.bannerUrl,
        bannerError: generated.bannerError,
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

  const totalBatches = Math.ceil(SAMPLE_BRIEFS.length / 2);
  return NextResponse.json({
    ok: true,
    storeSlug,
    samples: results,
    batch,
    hasMore: batch + 1 < totalBatches,
  });
}
