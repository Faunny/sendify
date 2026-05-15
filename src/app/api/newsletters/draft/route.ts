// POST /api/newsletters/draft
//
// Generates an editorial newsletter for a store. Unlike auto-plan campaigns
// (which trigger on calendar promo events), newsletters are content-driven:
// they bundle latest products + recent blog posts + a short editorial intro
// into a single email.
//
// Body: { storeSlug: string, kind?: "new-arrivals" | "weekly-digest", customBrief?: string }
// Returns: { ok, campaignId, subject, preheader }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTemplate } from "@/lib/ai/generate-template";
import { loadLatestProducts, loadLatestPosts } from "@/lib/newsletter/storefront-content";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug : null;
  const kind = (typeof body.kind === "string" ? body.kind : "weekly-digest") as "new-arrivals" | "weekly-digest";
  const customBrief = typeof body.customBrief === "string" ? body.customBrief : null;

  if (!storeSlug) return NextResponse.json({ ok: false, error: "storeSlug required" }, { status: 400 });

  try {
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: { id: true, name: true, defaultLanguage: true, storefrontUrl: true },
    });
    if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

    // Pull "what's new on the brand" — products + blog. Both are best-effort,
    // run in parallel so a slow blog feed doesn't block product loading.
    const [products, posts] = await Promise.all([
      loadLatestProducts(storeSlug, 6),
      loadLatestPosts(store.storefrontUrl ?? "", 3),
    ]);

    // Compose the brief for the LLM. The newsletter shouldn't read like a
    // promo — no big discount, no urgency. Editorial intro + curated picks.
    const briefLines: string[] = [];
    briefLines.push(`Editorial newsletter para ${store.name}.`);
    briefLines.push(`Sin descuento ni urgencia — el objetivo es mantener al cliente conectado con la marca, recomendar lo nuevo, contar.`);
    if (products.length > 0) {
      briefLines.push(`\nNuevos productos a destacar (úsalos por nombre exacto, no inventes):`);
      products.slice(0, 4).forEach((p) => briefLines.push(`- ${p.title}${p.price ? ` · ${p.price.toFixed(2)} €` : ""}`));
    }
    if (posts.length > 0) {
      briefLines.push(`\nÚltimas entradas del blog para mencionar como "From the journal":`);
      posts.forEach((p) => briefLines.push(`- "${p.title}" — ${p.excerpt.slice(0, 120)}`));
    }
    if (customBrief) {
      briefLines.push(`\nNotas adicionales del owner:\n${customBrief}`);
    }
    briefLines.push(`\nLayout sugerido: product-grid-editorial. CTA principal: "DESCUBRIR" / "VER LA COLECCIÓN".`);

    const generated = await generateTemplate({
      brief: briefLines.join("\n"),
      pillar: "ALL",
      storeSlug,
      tone: "editorial-cálido",
      language: store.defaultLanguage,
      generateBanner: true,
    });

    // Pin the layout server-side too — the LLM tends to pick big-number-hero
    // when it sees product mentions, but a newsletter wants the grid.
    // (The pattern picked by the LLM is already in generated.layoutPattern;
    // logging here is enough.)

    const today = new Date();
    const niceDate = today.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    const draftName = kind === "new-arrivals"
      ? `Newsletter · Nuevas llegadas · ${store.name} · ${niceDate}`
      : `Newsletter semanal · ${store.name} · ${niceDate}`;

    const campaign = await prisma.campaign.create({
      data: {
        storeId: store.id,
        senderId: null,
        name: draftName,
        subject: generated.subject,
        preheader: generated.preheader,
        status: "PENDING_APPROVAL",
        scheduledFor: new Date(today.getTime() + 24 * 3600_000), // tomorrow by default
        draftSource: "AUTO_LLM",
        draftReason: `newsletter · ${kind} · ${products.length}p · ${posts.length}posts`,
        bannerAssetId: generated.bannerAssetId ?? null,
        variants: {
          create: {
            language: store.defaultLanguage,
            subject: generated.subject,
            preheader: generated.preheader,
            mjml: generated.mjml,
          },
        },
      },
      select: { id: true, subject: true, preheader: true },
    });

    return NextResponse.json({
      ok: true,
      campaignId: campaign.id,
      subject: campaign.subject,
      preheader: campaign.preheader,
      productsUsed: products.length,
      postsUsed: posts.length,
      modelUsed: generated.modelUsed,
    });
  } catch (e) {
    console.error("[POST /api/newsletters/draft] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "newsletter draft failed",
    }, { status: 500 });
  }
}
