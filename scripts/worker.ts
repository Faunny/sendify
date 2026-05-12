#!/usr/bin/env -S node --enable-source-maps
// Worker entry point — boots the pg-boss send worker and blocks until SIGTERM.
//
//   npm run worker
//
// Needs DATABASE_URL set to the same Neon (or RDS) instance the app uses. pg-boss creates
// its own `pgboss` schema there on first run. No Redis required.

import { startSendWorker } from "../src/lib/pipeline/send-worker";

console.log("→ Sendify send worker booting");
console.log(`  database: ${(process.env.DATABASE_URL ?? "(missing)").replace(/:[^:@]+@/, ":****@")}`);
console.log(`  ses rate: ${process.env.SES_RATE_PER_SECOND ?? "14"}/s`);
console.log(`  aws region: ${process.env.AWS_REGION ?? "eu-west-1"}\n`);

(async () => {
  try {
    const boss = await startSendWorker();
    console.log("✓ ready — waiting for send jobs (pg-boss / Neon)");

    async function shutdown(signal: string) {
      console.log(`\n${signal} received — draining…`);
      await boss.stop({ graceful: true, timeout: 30_000 });
      console.log("✓ worker closed");
      process.exit(0);
    }
    process.on("SIGINT",  () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (e) {
    console.error("Worker failed to start:", e);
    process.exit(1);
  }
})();
