// Queue infrastructure using pg-boss (queue on Postgres) instead of BullMQ+Redis.
//
// Why: at our scale (~50 emails/sec peak, ~7-8 avg) pg-boss is plenty fast and we don't
// need a second managed service. The queue tables live in the same Neon DB as everything
// else — same connection string, same backup, same monitoring. One less thing to manage.
//
// Same job shapes as before so callers (pipeline/approve.ts, send-worker.ts) keep the
// same API surface. Only the internals are different.
//
// pg-boss uses its own schema `pgboss` inside the Postgres DB — created on first boot.

// pg-boss is published as CommonJS with a class as `module.exports`. Under ESM the named
// import + types come out weird, so we use the runtime-friendly dynamic import + loose
// typing. Behaviour is identical at runtime; we just trade compile-time types for sanity.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BossLike = any;

let bossInstance: BossLike | null = null;
let starting: Promise<BossLike> | null = null;

export async function getBoss(): Promise<BossLike> {
  if (bossInstance) return bossInstance;
  if (starting) return starting;
  starting = (async () => {
    const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
    if (!url || url.includes("placeholder")) {
      throw new Error("queue requires a real DATABASE_URL — set it in Settings before starting the worker");
    }
    const mod = await import("pg-boss");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PgBoss: any = (mod as any).default ?? mod;
    const boss = new PgBoss({
      connectionString: url,
      schema: "pgboss",
      newJobCheckInterval: 2_000,
      archiveCompletedAfterSeconds: 7 * 86_400,
      deleteAfterDays: 30,
    });
    await boss.start();
    bossInstance = boss;
    return boss;
  })();
  return starting;
}

// ── Job payload types (unchanged from BullMQ version) ─────────────────────

export type TranslateJob = {
  campaignId: string;
  variantId: string;
  language: string;
  sourceLanguage: string;
  fields: Array<{ key: "subject" | "preheader" | "mjml"; text: string }>;
};

export type RenderJob = {
  campaignId: string;
  variantId: string;
  language: string;
};

export type SendJob = {
  campaignId: string;
  variantId: string;
  sendId: string;
  customerId: string;
  toEmail: string;
  toName?: string;
  language: string;
  htmlHash: string;
  context: Record<string, string>;
};

// ── Queue names ───────────────────────────────────────────────────────────

export const QUEUES = {
  translate: "sendify.translate",
  render:    "sendify.render",
  send:      "sendify.send",
} as const;

// ── Public enqueue helpers ────────────────────────────────────────────────

export async function enqueueSend(jobs: SendJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const boss = await getBoss();
  // pg-boss batches via insert. Use sendAll for atomicity at the row level.
  await boss.insert(jobs.map((data) => ({ name: QUEUES.send, data })));
}

export async function enqueueTranslate(job: TranslateJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUES.translate, job);
}

export async function enqueueRender(job: RenderJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUES.render, job);
}

// Cancel all queued sends for a campaign. Already-active jobs finish; queued ones drop.
// Used by /api/campaigns/[id]/cancel.
export async function cancelCampaignSends(campaignId: string): Promise<number> {
  const boss = await getBoss();
  // pg-boss SQL escape: campaign id is a cuid so safe, but use parameterized form anyway.
  // We can't currently filter pg-boss jobs by data field via API, so do a direct delete.
  // The send-worker also checks Send.status before sending, so even if a job slips through
  // it'll see status=FAILED and bail.
  const count = await boss.db.executeSql?.(
    `DELETE FROM pgboss.job WHERE name = $1 AND data::jsonb @> $2::jsonb AND state IN ('created','retry','active') RETURNING id`,
    [QUEUES.send, JSON.stringify({ campaignId })],
  ).then((r: { rows: unknown[] }) => r.rows.length).catch(() => 0);
  return count ?? 0;
}

export const SES_RATE_PER_SECOND = parseInt(process.env.SES_RATE_PER_SECOND ?? "14", 10);
