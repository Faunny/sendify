/**
 * Sendify seed.
 *
 * Boots a development DB with the 4 Divain stores, their senders, the 22 enabled languages,
 * the brand glossary skeleton, the promotional calendar, a handful of segments,
 * and a few sample campaigns in different statuses so the UI is alive on first run.
 *
 * Run: `npm run db:seed`
 */
import { PrismaClient } from "@prisma/client";
import { LANGUAGES } from "../src/lib/languages";
import { STORES, SENDERS, SEGMENTS, PROMOTIONS, CAMPAIGNS } from "../src/lib/mock";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Seeding admin user");
  const admin = await prisma.user.upsert({
    where: { email: "faun@divainparfums.com" },
    update: {},
    create: {
      email: "faun@divainparfums.com",
      name: "Faun",
      role: "ADMIN",
    },
  });

  console.log("→ Seeding stores");
  for (const s of STORES) {
    await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        shopifyDomain: s.shopifyDomain,
        shopifyAccessToken: "REPLACE_ME",
        countryCode: s.countryCode,
        defaultLanguage: s.defaultLanguage,
        currency: s.currency,
        productCount: s.productCount,
      },
    });
  }

  console.log("→ Seeding senders");
  for (const sn of SENDERS) {
    const store = await prisma.store.findUnique({ where: { slug: STORES.find((s) => s.id === sn.storeId)!.slug } });
    if (!store) continue;
    await prisma.sender.upsert({
      where: { fromEmail: sn.fromEmail },
      update: {},
      create: {
        storeId: store.id,
        name: `${sn.fromName} <${sn.fromEmail}>`,
        fromEmail: sn.fromEmail,
        fromName: sn.fromName,
        provider: sn.provider,
        dailyCap: sn.dailyCap,
        verified: sn.verified,
        dkimVerified: sn.verified,
        spfVerified: sn.verified,
        dmarcVerified: sn.verified,
      },
    });
  }

  console.log("→ Seeding glossary");
  await prisma.glossary.upsert({
    where: { name: "divain-brand" },
    update: {},
    create: {
      name: "divain-brand",
      pairs: {
        doNotTranslate: ["Divain", "Divain Parfums", "Divain Care", "100ml", "EDP", "EDT"],
        "es-ES": { fragrance: "fragancia", "long-lasting": "larga duración", "free shipping": "envío gratis" },
        "fr-FR": { fragrance: "parfum", "long-lasting": "longue tenue", "free shipping": "livraison offerte" },
        "de-DE": { fragrance: "Duft", "long-lasting": "lang anhaltend", "free shipping": "Gratisversand" },
        "it-IT": { fragrance: "fragranza", "long-lasting": "lunga durata", "free shipping": "spedizione gratuita" },
        "pt-PT": { fragrance: "perfume", "long-lasting": "longa duração", "free shipping": "envio gratuito" },
      },
    },
  });

  console.log("→ Seeding promotional calendar");
  for (const p of PROMOTIONS) {
    await prisma.promotion.create({
      data: {
        name: p.name,
        kind: p.kind,
        dateByCountry: p.dateByCountry,
        active: true,
      },
    });
  }

  console.log("→ Seeding segments");
  for (const s of SEGMENTS) {
    const storeSlug = STORES.find((x) => x.id === s.storeId)!.slug;
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) continue;
    await prisma.segment.create({
      data: {
        storeId: store.id,
        name: s.name,
        description: s.description,
        rules: { dummy: true },
        estimatedSize: s.size,
      },
    });
  }

  console.log("→ Seeding sample campaigns");
  for (const c of CAMPAIGNS) {
    const storeSlug = STORES.find((x) => x.id === c.storeId)!.slug;
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) continue;
    const sender = await prisma.sender.findFirst({ where: { storeId: store.id } });
    if (!sender) continue;

    await prisma.campaign.create({
      data: {
        storeId: store.id,
        senderId: sender.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        scheduledFor: new Date(c.scheduledFor),
        segmentIds: [],
        excludeAppRecent: true,
        estimatedRecipients: c.audience,
        estimatedCost: c.estimatedCost,
        actualCost: c.openRate ? c.estimatedCost : 0,
      },
    });
  }

  console.log(`✓ Seed complete. Admin: ${admin.email}`);
  console.log(`  ${LANGUAGES.length} languages, ${STORES.length} stores, ${SENDERS.length} senders, ${PROMOTIONS.length} promotions, ${SEGMENTS.length} segments, ${CAMPAIGNS.length} campaigns.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
