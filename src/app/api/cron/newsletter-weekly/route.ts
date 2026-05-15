// GET/POST /api/cron/newsletter-weekly
//
// Generates one weekly digest newsletter per active store. Scheduled by
// vercel.json to run every Monday 09:00 UTC. Each newsletter lands in
// /approvals as PENDING_APPROVAL with senderId=null — the reviewer can
// edit / pick a sender / approve from there.
//
// Auth: Bearer CRON_SECRET or admin session.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTemplate } from "@/lib/ai/generate-template";
import { loadLatestProducts, loadLatestPosts } from "@/lib/newsletter/storefront-content";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authH = req.headers.get("authorization");
  if (cronSecret && authH === `Bearer ${cronSecret}`) return true;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const stores = await prisma.store.findMany({
    where: { active: true },
    select: { id: true, slug: true, name: true, defaultLanguage: true, storefrontUrl: true },
  });

  let created = 0;
  const errors: string[] = [];
  for (const store of stores) {
    try {
      // Skip if we already generated a weekly digest in the last 6 days for
      // this store — protects against the cron firing twice and double-
      // drafting.
      const recent = await prisma.campaign.findFirst({
        where: {
          storeId: store.id,
          draftSource: "AUTO_LLM",
          draftReason: { startsWith: "newsletter · weekly-digest" },
          createdAt: { gte: new Date(Date.now() - 6 * 86_400_000) },
        },
        select: { id: true },
      });
      if (recent) continue;

      const [products, posts] = await Promise.all([
        loadLatestProducts(store.slug, 6),
        loadLatestPosts(store.storefrontUrl ?? "", 3),
      ]);

      const briefLines: string[] = [
        `Newsletter editorial semanal para ${store.name}. Sin descuento ni urgencia — el objetivo es mantener al cliente conectado con la marca, recomendar lo nuevo, contar.`,
      ];
      if (products.length > 0) {
        briefLines.push(`\nNuevos productos a destacar (úsalos por nombre exacto, no inventes):`);
        products.slice(0, 4).forEach((p) => briefLines.push(`- ${p.title}${p.price ? ` · ${p.price.toFixed(2)} €` : ""}`));
      }
      if (posts.length > 0) {
        briefLines.push(`\nÚltimas entradas del blog:`);
        posts.forEach((p) => briefLines.push(`- "${p.title}" — ${p.excerpt.slice(0, 120)}`));
      }
      briefLines.push(`\nLayout sugerido: product-grid-editorial. CTA: "DESCUBRIR".`);

      const generated = await generateTemplate({
        brief: briefLines.join("\n"),
        pillar: "ALL",
        storeSlug: store.slug,
        tone: "editorial-cálido",
        language: store.defaultLanguage,
        generateBanner: true,
      });

      const today = new Date();
      await prisma.campaign.create({
        data: {
          storeId: store.id,
          senderId: null,
          name: `Newsletter semanal · ${store.name} · ${today.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`,
          subject: generated.subject,
          preheader: generated.preheader,
          status: "PENDING_APPROVAL",
          scheduledFor: new Date(today.getTime() + 24 * 3600_000),
          draftSource: "AUTO_LLM",
          draftReason: `newsletter · weekly-digest · ${products.length}p · ${posts.length}posts`,
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
      });
      created++;
    } catch (e) {
      errors.push(`${store.slug}: ${e instanceof Error ? e.message.slice(0, 140) : "failed"}`);
    }
  }

  return NextResponse.json({ ok: true, storesProcessed: stores.length, newslettersCreated: created, errors });
}

export async function GET(req: Request) {
  return POST(req);
}
