#!/usr/bin/env -S node --enable-source-maps
// Klaviyo bulk importer.
//
// Streams a Klaviyo profile CSV directly to the Sendify Postgres in batches of 5k.
// Memory-safe for 1.5M+ rows · uses skipDuplicates so a re-run is idempotent.
//
// Usage:
//   tsx scripts/import-klaviyo.ts \
//     --csv ./klaviyo-divain-europa-2026-05.csv \
//     --store st_1 \
//     [--dry-run] [--batch-size 5000]
//
// Run from your laptop with DATABASE_URL pointing at the prod DB. Direct URL is fine
// (bypassing RDS Proxy gives better throughput on bulk insert anyway).

import { PrismaClient } from "@prisma/client";
import { streamKlaviyoCsv } from "../src/lib/import/klaviyo";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    csv:        { type: "string" },
    store:      { type: "string" },
    "dry-run":  { type: "boolean", default: false },
    "batch-size": { type: "string", default: "5000" },
    help:       { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !values.csv || !values.store) {
  console.log(`
Klaviyo → Sendify importer

  --csv         path to Klaviyo profile CSV (required)
  --store       Sendify store id (required, e.g. st_1, st_2, st_3, st_4)
  --batch-size  rows per createMany call (default 5000)
  --dry-run     parse + map but don't write to the DB

  DATABASE_URL  must point at the Sendify Postgres
`);
  process.exit(values.help ? 0 : 1);
}

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

async function main() {
  const start = performance.now();
  console.log(`▶ Klaviyo import`);
  console.log(`  csv:        ${values.csv}`);
  console.log(`  store:      ${values.store}`);
  console.log(`  batch size: ${values["batch-size"]}`);
  console.log(`  mode:       ${values["dry-run"] ? "DRY-RUN (no DB writes)" : "LIVE"}\n`);

  // Sanity check the store exists before reading 1.5M rows for nothing.
  if (!values["dry-run"]) {
    const store = await prisma.store.findUnique({ where: { id: values.store! } });
    if (!store) {
      console.error(`✗ store ${values.store} not found in DB. Did you seed first?`);
      process.exit(1);
    }
    console.log(`✓ store: ${store.name} · default lang ${store.defaultLanguage}\n`);
  }

  let inserted = 0;
  let lastReport = performance.now();

  const stream = streamKlaviyoCsv({
    path: values.csv!,
    storeId: values.store!,
    batchSize: parseInt(values["batch-size"]!, 10),
  });

  for await (const batch of stream) {
    if (!values["dry-run"]) {
      // createMany skipDuplicates: idempotent re-runs, ignores conflicts on
      // (storeId, shopifyId) and (storeId, email) unique indexes.
      const r = await prisma.customer.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += r.count;
    } else {
      inserted += batch.length;
    }

    const now = performance.now();
    if (now - lastReport > 1500) {
      const elapsed = (now - start) / 1000;
      const rate = Math.round(inserted / elapsed);
      console.log(`  ${inserted.toLocaleString().padStart(10)} customers  ·  ${rate.toLocaleString()}/s  ·  ${elapsed.toFixed(0)}s elapsed`);
      lastReport = now;
    }
  }

  const elapsed = (performance.now() - start) / 1000;
  console.log(`\n✓ Done`);
  console.log(`  Customers inserted: ${inserted.toLocaleString()}`);
  console.log(`  Elapsed:            ${elapsed.toFixed(1)}s`);
  console.log(`  Rate:               ${Math.round(inserted / elapsed).toLocaleString()}/s`);
  if (values["dry-run"]) console.log(`\n  ⚠️  DRY-RUN — nothing was written. Drop --dry-run to import for real.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
