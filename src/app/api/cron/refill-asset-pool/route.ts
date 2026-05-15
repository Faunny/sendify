// GET/POST /api/cron/refill-asset-pool
//
// Auto-refills the image asset pool so the email generator never has to call
// the image provider at runtime. This is the "always connected, always full"
// pool the user asked for: Higgsfield doesn't expose an API, so instead of
// bridging to Higgsfield manually we just generate the photos ourselves via
// Gemini Nano Banana (with the product reference) on a schedule.
//
// Per tick the cron:
//   1. Reads the (layoutPattern × storeSlug) combos that are deficit > 0
//   2. Picks the top REFILL_PER_TICK most deficient ones
//   3. For each, calls generateBannerAny with the pattern-aware prompt + the
//      store's first Shopify product as a reference
//   4. Saves the image to the Asset library with the right tags so the email
//      generator finds it on next lookup
//
// Auth: Bearer CRON_SECRET (Vercel cron) OR admin session (manual "refill now"
// button on /assets).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LAYOUT_LIBRARY } from "@/lib/ai/template-patterns";
import { generateBannerAny } from "@/lib/banner-provider";
import { buildHeroPromptForLayout } from "@/lib/ai/generate-template";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Same target as /api/assets/pool-status. Keep these in sync.
const TARGET_DEPTH_PER_COMBO = 3;
// Per-cron-tick budget. With image gen at ~45s each, 4 per tick = ~180s of
// work which is safely inside Vercel's 300s function cap.
const REFILL_PER_TICK = 4;
// Version marker; matches the lookup in generate-template.ts so future
// generations actually use these assets.
const PROMPT_VERSION = "v4-with-product";

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authH = req.headers.get("authorization");
  if (cronSecret && authH === `Bearer ${cronSecret}`) return true;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const stores = await prisma.store.findMany({
      where: { active: true },
      select: { id: true, slug: true, name: true, brandPalette: true, defaultLanguage: true, currency: true, storefrontUrl: true },
    });

    // Per-combo unused count — same logic as /api/assets/pool-status but
    // inlined here so the cron isn't doing an HTTP round-trip to itself.
    const unused = await prisma.asset.findMany({
      where: { kind: "IMAGE", usedCount: 0, tags: { has: PROMPT_VERSION } },
      select: { tags: true },
    });
    type Combo = { layoutPattern: string; storeSlug: string; storeId: string; deficit: number };
    const combos: Combo[] = [];
    for (const layout of LAYOUT_LIBRARY) {
      for (const store of stores) {
        const count = unused.filter((a) => a.tags.includes(layout.id) && a.tags.includes(store.slug)).length;
        const deficit = Math.max(0, TARGET_DEPTH_PER_COMBO - count);
        if (deficit > 0) combos.push({ layoutPattern: layout.id, storeSlug: store.slug, storeId: store.id, deficit });
      }
    }
    combos.sort((a, b) => b.deficit - a.deficit);
    const work = combos.slice(0, REFILL_PER_TICK);

    if (work.length === 0) {
      return NextResponse.json({ ok: true, generated: 0, message: "pool full — nothing to refill" });
    }

    // Pre-resolve a pool of product photos per store so each refill job picks
    // a DIFFERENT bottle. Without this rotation the cron generates 8 photos
    // for divain-europa that all feature the same product — no variety.
    // Keeping the top 20 most-recently-updated active products per store
    // gives plenty of rotation room.
    const productsByStore = new Map<string, string[]>();
    for (const store of stores) {
      const ps = await prisma.product.findMany({
        where: { storeId: store.id, status: "active", imageUrl: { not: null } },
        select: { imageUrl: true },
        orderBy: { shopifyUpdatedAt: "desc" },
        take: 20,
      }).catch((e) => {
        // Log + return empty so the cron continues for other stores. Silent
        // .catch(() => []) used to make this look like "no products" instead
        // of a DB error (audit fix).
        console.error(`[refill-asset-pool] failed to load products for store ${store.id}:`, e);
        return [];
      });
      const urls = ps.map((p) => p.imageUrl).filter((u): u is string => !!u);
      if (urls.length > 0) productsByStore.set(store.id, urls);
    }

    let generated = 0;
    const errors: string[] = [];
    for (let idx = 0; idx < work.length; idx++) {
      const job = work[idx];
      try {
        // Rotate through the store's product photos so each pool refill cycle
        // covers different bottles. Indexed by job position + clock so two
        // consecutive ticks don't pick the same product.
        const pool = productsByStore.get(job.storeId) ?? [];
        const productRef = pool.length > 0 ? pool[(idx + Math.floor(Date.now() / 60_000)) % pool.length] : undefined;
        // No store-specific brief from the LLM here — we're filling speculative
        // pool entries that any event can reuse. The pattern-aware prompt
        // already produces a generic editorial scene per layout.
        const prompt = buildHeroPromptForLayout(job.layoutPattern, "", !!productRef);
        const store = stores.find((s) => s.id === job.storeId);
        const palette = (store?.brandPalette ?? {}) as { primary?: string; bg?: string; text?: string };

        const img = await generateBannerAny({
          prompt,
          aspectRatio: "3:2",
          brandHints: {
            palette: [palette.primary, palette.bg, palette.text].filter(Boolean) as string[],
            style: "editorial luxury perfume photography",
            avoidText: true,
          },
          quality: "medium",
          referenceImageUrls: productRef ? [productRef] : [],
          // User pref: try OpenAI gpt-image-2 first (the openai-image adapter
          // already auto-downgrades to gpt-image-1 if -2 isn't available on
          // the account). Gemini Nano Banana remains the fallback on quota
          // exhaustion so the pool still fills if OpenAI runs out.
          preferredProvider: "openai",
        });
        const bytes = Buffer.from(img.base64, "base64");
        await prisma.asset.create({
          data: {
            name: `pool-${job.layoutPattern}-${job.storeSlug}-${Date.now()}`,
            kind: "IMAGE",
            mimeType: img.mimeType,
            data: new Uint8Array(bytes),
            sizeBytes: bytes.length,
            tags: ["ai-generated", "hero", job.layoutPattern, job.storeSlug, PROMPT_VERSION, "pool-refill"],
            prompt: prompt.slice(0, 800),
            // Notes capture which product was used as the bottle reference,
            // useful for "why is the wrong perfume in this hero" debugging.
            notes: productRef ? `Product ref: ${productRef.slice(0, 240)}` : "no product ref (no synced products)",
            generatedBy: `cron:refill-pool · ${img.provider}`,
            usedCount: 0, // available for next email
          },
        });
        generated++;
      } catch (e) {
        errors.push(`${job.layoutPattern}/${job.storeSlug}: ${e instanceof Error ? e.message.slice(0, 140) : "failed"}`);
      }
    }

    return NextResponse.json({
      ok: true,
      generated,
      attempted: work.length,
      stillPending: Math.max(0, combos.length - work.length),
      errors,
    });
  } catch (e) {
    console.error("[refill-asset-pool] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "refill failed",
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
