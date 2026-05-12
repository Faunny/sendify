/**
 * Sendify seed.
 *
 * Boots the DB with the 4 real divain Shopify Plus stores + their 4 SES sender identities
 * + the 22 enabled languages glossary skeleton + the 4 product pillars. Nothing else is
 * seeded — campaigns/customers/products come from real Shopify webhooks + Klaviyo import.
 *
 * Run: `npm run db:seed` (or `tsx prisma/seed.ts` with DATABASE_URL pointing at Neon).
 * Idempotent: safe to re-run, upserts on slug/email/name.
 */
import { PrismaClient } from "@prisma/client";
import { LANGUAGES } from "../src/lib/languages";
import { STORES, SENDERS } from "../src/lib/mock";

const prisma = new PrismaClient();

async function main() {
  console.log("▶ Seeding Sendify production data");

  console.log("→ Admin user (Faun)");
  const admin = await prisma.user.upsert({
    where: { email: "faun.de@divainteam.com" },
    update: { name: "Faun", role: "ADMIN" },
    create: {
      email: "faun.de@divainteam.com",
      name: "Faun",
      role: "ADMIN",
    },
  });

  console.log("→ 4 Shopify Plus stores (divain · Europa, UK, USA+CA, México)");
  const storeIds = new Map<string, string>(); // slug → real DB id
  for (const s of STORES) {
    const row = await prisma.store.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        shopifyDomain: s.shopifyDomain,
        storefrontUrl: s.storefrontUrl,
        countryCode: s.countryCode,
        defaultLanguage: s.defaultLanguage,
        currency: s.currency,
        markets: s.markets,
        legalName: s.legal.legalName,
        vatNumber: s.legal.vatNumber,
        legalAddress: s.legal.address,
        legalPostalCode: s.legal.postalCode,
        legalCity: s.legal.city,
        legalCountry: s.legal.country,
        supportEmail: s.legal.supportEmail,
        supportPhone: s.legal.supportPhone,
        privacyUrl: s.legal.privacyUrl,
        termsUrl: s.legal.termsUrl,
        cookiesUrl: s.legal.cookiesUrl,
        brandPalette: s.brand.palette,
        brandFontHeading: s.brand.fontHeading,
        brandFontBody: s.brand.fontBody,
      },
      create: {
        slug: s.slug,
        name: s.name,
        shopifyDomain: s.shopifyDomain,
        shopifyAccessToken: "REPLACE_ME",
        storefrontUrl: s.storefrontUrl,
        countryCode: s.countryCode,
        defaultLanguage: s.defaultLanguage,
        currency: s.currency,
        markets: s.markets,
        legalName: s.legal.legalName,
        vatNumber: s.legal.vatNumber,
        legalAddress: s.legal.address,
        legalPostalCode: s.legal.postalCode,
        legalCity: s.legal.city,
        legalCountry: s.legal.country,
        supportEmail: s.legal.supportEmail,
        supportPhone: s.legal.supportPhone,
        privacyUrl: s.legal.privacyUrl,
        termsUrl: s.legal.termsUrl,
        cookiesUrl: s.legal.cookiesUrl,
        brandPalette: s.brand.palette,
        brandFontHeading: s.brand.fontHeading,
        brandFontBody: s.brand.fontBody,
      },
    });
    storeIds.set(s.id, row.id);
    console.log(`   ✓ ${row.name}  →  ${row.legalName}`);
  }

  console.log("→ 4 SES sender identities");
  for (const sn of SENDERS) {
    const storeRealId = storeIds.get(sn.storeId);
    if (!storeRealId) continue;
    await prisma.sender.upsert({
      where: { fromEmail: sn.fromEmail },
      update: {
        storeId: storeRealId,
        name: `${sn.fromName} <${sn.fromEmail}>`,
        fromName: sn.fromName,
        provider: sn.provider,
        dailyCap: sn.dailyCap,
        warmupTargetPerDay: sn.warmupTargetPerDay,
      },
      create: {
        storeId: storeRealId,
        name: `${sn.fromName} <${sn.fromEmail}>`,
        fromEmail: sn.fromEmail,
        fromName: sn.fromName,
        provider: sn.provider,
        dailyCap: sn.dailyCap,
        warmupTargetPerDay: sn.warmupTargetPerDay,
        verified: false, // user verifies DKIM/SPF/DMARC in AWS SES
      },
    });
    console.log(`   ✓ ${sn.fromName}  →  ${sn.fromEmail}`);
  }

  console.log("→ Brand glossary skeleton (empty pairs, to be filled per-language)");
  await prisma.glossary.upsert({
    where: { name: "divain-brand" },
    update: {},
    create: {
      name: "divain-brand",
      pairs: {
        doNotTranslate: ["Divain", "divain.", "Divain Parfums", "100ml", "EDP", "EDT", "PARFUMS", "CARE", "HOME", "RITUAL"],
      },
    },
  });
  console.log("   ✓ glossary divain-brand created (preserves brand terms across 22 languages)");

  console.log(`\n✓ Seed complete`);
  console.log(`  Admin:     ${admin.email}`);
  console.log(`  Stores:    ${STORES.length}`);
  console.log(`  Senders:   ${SENDERS.length}`);
  console.log(`  Languages: ${LANGUAGES.length} (loaded from src/lib/languages.ts, not stored in DB)`);
  console.log(`\nWhat's NOT seeded (real data only):`);
  console.log(`  - Campaigns       → create from /campaigns/new`);
  console.log(`  - Customers       → import from Klaviyo CSV (npm run import:klaviyo) or Shopify sync`);
  console.log(`  - Products        → sync from Shopify webhooks`);
  console.log(`  - Promotions      → push from your external calendar via webhook`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
