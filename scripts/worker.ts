// Worker entry point.
//
// Run with `npm run worker`. Boots the send worker (which connects to Redis + SES)
// and stays running until SIGTERM/SIGINT. In production deploy as a separate ECS
// Fargate service so a UI deploy can't accidentally restart in-flight sends.
//
// You'll want one worker process per ~50 concurrent SES connections. At 14 emails/sec
// that's overkill; at 200 emails/sec one worker is still fine; at 1000 emails/sec run
// 2-3 workers with the BullMQ limiter sharing the rate ceiling across them via Redis.

import { startSendWorker } from "../src/lib/pipeline/send-worker";

console.log("→ Sendify send worker booting");
console.log(`  redis:           ${process.env.REDIS_URL ?? "redis://localhost:6379"}`);
console.log(`  ses rate/sec:    ${process.env.SES_RATE_PER_SECOND ?? "14"}`);
console.log(`  aws region:      ${process.env.AWS_REGION ?? "eu-west-1"}`);
console.log(`  config set:      ${process.env.SES_CONFIGURATION_SET ?? "(default)"}\n`);

const worker = startSendWorker();

worker.on("ready", () => console.log("✓ ready — waiting for send jobs"));
worker.on("completed", (job, _result) => {
  console.log(`✓ ${job.data.toEmail}  →  msgId ${_result?.messageId ?? "—"}`);
});
worker.on("failed", (job, err) => {
  console.warn(`✗ ${job?.data?.toEmail ?? "?"}  →  attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${err.message}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — draining…`);
  await worker.close();
  console.log("✓ worker closed");
  process.exit(0);
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
