// BullMQ queue infrastructure.
//
// Three queues, all backed by Redis:
//   - `translate`  — one job per (campaign, language) → ensures DeepL cache is warm
//   - `render`     — one job per (campaign, language) → compiles MJML to HTML, snapshots
//   - `send`       — one job per recipient → SES SendEmail
//
// `send` is rate-limited via BullMQ's built-in `limiter` to respect the SES quota
// (default 14 emails/sec for new accounts, configurable up to 1000s/sec on request).
// Workers retry transient SES errors (429, 503) with exponential backoff.
//
// **Lazy connection**: the queues only open a Redis connection on first use. The Next.js
// server can boot and serve the UI even if Redis is down — only worker processes and
// the approve action actually touch the queues. This keeps local dev frictionless.

import { Queue, type QueueOptions } from "bullmq";
import IORedis, { type Redis } from "ioredis";

let connection: Redis | null = null;
export function getRedis(): Redis {
  if (!connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    connection = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });
    connection.on("error", (e) => {
      // Avoid spamming on dev when Redis isn't running. One log per crash burst.
      if (process.env.NODE_ENV !== "production") console.warn("[queue] redis:", e.message);
    });
  }
  return connection;
}

const defaultOpts: QueueOptions = {
  connection: undefined as unknown as Redis, // set lazily below
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail:     { age: 7 * 24 * 3600 },
  },
};

const cache = new Map<string, Queue>();
function getQueue<T>(name: "translate" | "render" | "send"): Queue<T> {
  const existing = cache.get(name);
  if (existing) return existing as Queue<T>;
  const q = new Queue<T>(name, { ...defaultOpts, connection: getRedis() });
  cache.set(name, q);
  return q;
}

// ── Job payload types ────────────────────────────────────────────────────────

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
  sendId: string;        // pre-created `Send` row id (status QUEUED)
  customerId: string;
  toEmail: string;
  toName?: string;
  language: string;
  htmlHash: string;       // matches CampaignVariant.htmlHash for audit
  context: Record<string, string>; // personalization tokens: first_name, discount_code, …
};

// ── Public queue accessors ───────────────────────────────────────────────────

export const translateQueue = () => getQueue<TranslateJob>("translate");
export const renderQueue    = () => getQueue<RenderJob>("render");
export const sendQueue      = () => getQueue<SendJob>("send");

// ── Throughput config ────────────────────────────────────────────────────────
// We default to SES "production tier 1" (14 emails/sec). On AWS request approval
// for higher rates and bump these via env: SES_RATE_PER_SECOND=200.

export const SES_RATE_PER_SECOND = parseInt(process.env.SES_RATE_PER_SECOND ?? "14", 10);
