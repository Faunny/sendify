// Auto-planner. Walks the marketing calendar and, for each upcoming event that
// (a) falls inside the lead window for its store and (b) doesn't already have a
// draft campaign attached, calls the AI template generator to produce a full
// draft. The draft lands in the approvals inbox at status=PENDING_APPROVAL.
//
// Triggered manually from /calendar ("Plan próximos 30 días") and automatically
// from a Vercel daily cron. Idempotent: re-running the planner on the same day
// skips events that already have an open draft.

import { prisma } from "../db";
import { generateTemplate } from "../ai/generate-template";
import { MARKETING_CALENDAR_2026, dateForStore, STORE_COUNTRY, type CalendarEvent } from "../calendar/marketing-events";

// Bridge: a Promotion row coming in via webhook gets wrapped as a CalendarEvent
// so the rest of the planner doesn't care where the event came from.
function promotionToEvent(p: {
  externalId: string | null;
  name: string;
  kind: "GLOBAL" | "REGIONAL" | "STORE";
  dateByCountry: unknown;
  leadDays: number;
  briefForLlm: string | null;
  bannerPrompt: string | null;
}): CalendarEvent {
  return {
    slug: p.externalId ?? `promo-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`,
    name: p.name,
    kind: p.kind === "STORE" ? "BRAND_OWN" : p.kind,
    pillar: "ALL",
    dateByCountry: (p.dateByCountry ?? {}) as Record<string, string>,
    brief: p.briefForLlm ?? `${p.name} — drafted from the marketing calendar webhook.`,
    tone: "editorial-cálido",
    leadDays: p.leadDays,
  };
}

export type AutoPlanResult = {
  planned: Array<{
    storeSlug: string;
    eventSlug: string;
    eventName: string;
    sendDate: string;
    leadDays: number;
    campaignId: string;
    subject: string;
  }>;
  skipped: Array<{ storeSlug: string; eventSlug: string; reason: string }>;
  failed:  Array<{ storeSlug: string; eventSlug: string; error: string }>;
  // True when more in-window drafts exist beyond this invocation's batch cap.
  // The UI re-fires autoPlan in a loop until pendingCount drops to 0.
  pendingCount: number;
  batchSize: number;
};

const DEFAULT_HORIZON_DAYS = 30;
// Max drafts per autoPlan invocation. Each draft = 1 LLM call (~5-12s) plus a
// DB write — at concurrency 4 that's ~20s per batch of 4, so 24 drafts ≈ 120s,
// well inside Vercel's 300s function cap with margin for the cold start. The
// rest are returned via pendingCount and processed on the next call.
const BATCH_MAX = 24;
// Parallel concurrency. Sized to keep DeepSeek/OpenAI under their typical
// rate-limit (~5 rpm on basic plans) while still finishing the batch quickly.
const CONCURRENCY = 4;

export async function autoPlan(opts?: { horizonDays?: number; onlyStoreSlug?: string }): Promise<AutoPlanResult> {
  const horizon = opts?.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizon * 86_400_000);

  const result: AutoPlanResult = { planned: [], skipped: [], failed: [], pendingCount: 0, batchSize: BATCH_MAX };

  // Load stores once. Auto-planner targets every store unless restricted.
  const stores = await prisma.store.findMany({
    where: opts?.onlyStoreSlug ? { slug: opts.onlyStoreSlug } : undefined,
    select: { id: true, slug: true, name: true, defaultLanguage: true, currency: true },
  });

  // Load every active Promotion row (webhook-pushed events) and treat each one
  // as a CalendarEvent for the planner. The seeded MARKETING_CALENDAR_2026
  // entries provide a fallback when the upstream is silent.
  const promotionEvents: CalendarEvent[] = (await prisma.promotion.findMany({
    where: { active: true, autoDraft: true },
    select: { externalId: true, name: true, kind: true, dateByCountry: true, leadDays: true, briefForLlm: true, bannerPrompt: true },
  }).catch(() => [])).map(promotionToEvent);

  const allEvents: CalendarEvent[] = [...promotionEvents, ...MARKETING_CALENDAR_2026];
  // Dedupe by slug so a webhook-supplied event with the same slug as a seeded
  // one wins (upstream is the source of truth).
  const eventsBySlug = new Map<string, CalendarEvent>();
  for (const e of allEvents) eventsBySlug.set(e.slug, e);
  const events = [...eventsBySlug.values()];

  // Pre-resolve sender for every store once (saves a query per event).
  const senderByStoreId = new Map<string, { id: string; fromEmail: string; fromName: string } | null>();
  for (const store of stores) {
    const s = await prisma.sender.findFirst({
      where: { storeId: store.id, verified: true },
      select: { id: true, fromEmail: true, fromName: true },
    });
    senderByStoreId.set(store.id, s);
  }

  // ── Phase 1: classify every (store, event) pair without touching the LLM.
  //    Anything that can be decided cheaply (out-of-window, no date, already
  //    drafted, bad date) is recorded immediately. The remainder becomes the
  //    draftable queue to feed in parallel.
  type Job = {
    store: typeof stores[number];
    event: CalendarEvent;
    sender: { id: string; fromEmail: string; fromName: string } | null;
    sendDate: Date;
    sendDateIso: string;
  };
  const queue: Job[] = [];

  for (const store of stores) {
    for (const event of events) {
      const sendDateIso = dateForStore(event, store.slug);
      if (!sendDateIso) continue; // not for this store
      const sendDate = new Date(sendDateIso);
      if (isNaN(sendDate.getTime())) {
        result.failed.push({ storeSlug: store.slug, eventSlug: event.slug, error: `bad date ${sendDateIso}` });
        continue;
      }
      const draftWindowStart = new Date(sendDate.getTime() - event.leadDays * 86_400_000);
      if (now < draftWindowStart || now > sendDate) {
        if (sendDate > now && sendDate <= horizonEnd) {
          result.skipped.push({ storeSlug: store.slug, eventSlug: event.slug, reason: `lead window opens ${draftWindowStart.toISOString().slice(0, 10)}` });
        }
        continue;
      }
      const existing = await prisma.campaign.findFirst({
        where: {
          storeId: store.id,
          draftReason: { contains: event.slug },
          status: { in: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED"] },
        },
        select: { id: true },
      }).catch(() => null);
      if (existing) {
        result.skipped.push({ storeSlug: store.slug, eventSlug: event.slug, reason: "draft already exists" });
        continue;
      }
      queue.push({ store, event, sender: senderByStoreId.get(store.id) ?? null, sendDate, sendDateIso });
    }
  }

  // ── Phase 2: drain up to BATCH_MAX from the queue, CONCURRENCY in flight at
  //    once. Anything left over is reported as pendingCount so the UI knows
  //    to call again. This is what keeps a 50-draft workload from blowing the
  //    function timeout — each invocation does a finite, bounded chunk.
  const toRun = queue.slice(0, BATCH_MAX);
  result.pendingCount = Math.max(0, queue.length - toRun.length);

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= toRun.length) return;
      const job = toRun[i];
      try {
        const created = await draftCampaignForEvent({
          event: job.event,
          store: job.store,
          sender: job.sender,
          sendDate: job.sendDate,
        });
        result.planned.push({
          storeSlug: job.store.slug,
          eventSlug: job.event.slug,
          eventName: job.event.name,
          sendDate: job.sendDateIso,
          leadDays: job.event.leadDays,
          campaignId: created.id,
          subject: created.subject,
        });
      } catch (e) {
        result.failed.push({
          storeSlug: job.store.slug,
          eventSlug: job.event.slug,
          error: e instanceof Error ? e.message.slice(0, 200) : "draft failed",
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toRun.length) }, () => worker()));

  return result;
}

async function draftCampaignForEvent(args: {
  event: CalendarEvent;
  store: { id: string; slug: string; defaultLanguage: string; currency: string; name: string };
  // Optional — drafts can exist without a sender, the user wires one up
  // before approving.
  sender: { id: string; fromEmail: string; fromName: string } | null;
  sendDate: Date;
}) {
  const { event, store, sender, sendDate } = args;

  // 1. Call the AI generator with the calendar brief + brand palette.
  //
  // generateBanner: false — auto-plan runs across all stores × all in-window
  // events in one Vercel function call (5-min cap). Banner generation via
  // Gemini takes 30-60s per draft; with image gen on, drafting 5+ events
  // blows the function timeout. The MJML is created with a placeholder hero;
  // the reviewer can hit "Generar imagen" per-draft from /approvals when
  // they're ready to send.
  const ai = await generateTemplate({
    brief: event.brief,
    pillar: event.pillar,
    storeSlug: store.slug,
    tone: event.tone,
    language: store.defaultLanguage,
    generateBanner: false,
  });

  // 2. Create a Promotion row (idempotent on externalId) so the campaign has a
  //    proper tie-back for analytics + the approval UI shows the event context.
  const promotion = await prisma.promotion.upsert({
    where: { externalId: `${event.slug}::${store.slug}` },
    create: {
      storeId: store.id,
      name: event.name,
      // Schema's PromotionKind has GLOBAL | REGIONAL | STORE — map BRAND_OWN → STORE.
      kind: event.kind === "BRAND_OWN" ? "STORE" : event.kind,
      dateByCountry: event.dateByCountry,
      externalId: `${event.slug}::${store.slug}`,
      externalSource: "auto-planner",
      autoDraft: true,
      leadDays: event.leadDays,
      briefForLlm: event.brief,
    },
    update: { active: true, briefForLlm: event.brief },
  });

  // 3. Create the campaign + the source-language variant carrying the MJML.
  const campaign = await prisma.campaign.create({
    data: {
      storeId: store.id,
      senderId: sender?.id ?? null,
      promotionId: promotion.id,
      name: `${event.name} · ${store.name}`,
      subject: ai.subject,
      preheader: ai.preheader,
      status: "PENDING_APPROVAL",
      scheduledFor: sendDate,
      segmentIds: [],
      excludeAppRecent: true,
      appSuppressionHours: 24,
      draftSource: "AUTO_PROMOTION",
      draftReason: `${event.slug} · ${event.leadDays}d before ${sendDate.toISOString().slice(0, 10)}`,
      draftLlmPrompt: event.brief,
      variants: {
        create: {
          language: store.defaultLanguage,
          subject: ai.subject,
          preheader: ai.preheader,
          mjml: ai.mjml,
        },
      },
    },
  });

  return { id: campaign.id, subject: ai.subject };
}
