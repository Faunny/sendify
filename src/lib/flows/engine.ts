// Flow engine — enrolls customers and ticks them through their graph.
//
// Two entry points:
//   • `enrollIntoMatchingFlows(storeId, customerId, trigger, context)` — called
//     from the Shopify webhook handlers whenever an event fires that could
//     activate a flow. Creates a FlowEnrollment per matching active flow
//     (subject to per-flow cooldown).
//   • `tickDueEnrollments()` — called by the Vercel cron at /api/cron/flows-tick.
//     Pulls every ACTIVE enrollment whose nextRunAt has passed and walks the
//     next step (delay → set future nextRunAt; send → render+SES+Send row).
//
// Synchronous send-within-tick (no queue indirection) because flow volumes are
// low — at most one email per customer per few hours. Campaign blasts use the
// pg-boss path, this doesn't need to.

import { prisma } from "@/lib/db";
import { renderMjml } from "@/lib/mjml";
import { sendEmail } from "@/lib/ses";
import type { FlowTrigger, FlowEnrollment } from "@prisma/client";
import { FLOW_PRESETS, type EntryFilter, type FlowGraph, type FlowStep, type FlowStepCondition } from "./presets";

// ── Enrollment ───────────────────────────────────────────────────────────────

export async function enrollIntoMatchingFlows(args: {
  storeId: string;
  customerId: string;
  trigger: FlowTrigger;
  context?: Record<string, unknown>;
}): Promise<{ enrolled: number; skipped: number }> {
  const flows = await prisma.flow.findMany({
    where: { storeId: args.storeId, trigger: args.trigger, active: true },
    select: { id: true, name: true, reEnrollCooldownH: true, graph: true },
  });

  if (flows.length === 0) return { enrolled: 0, skipped: 0 };

  // Resolve the customer once — entry filters need ordersCount / totalSpent /
  // consentStatus, and we'd rather not fetch the row per flow.
  const customer = await prisma.customer.findUnique({
    where: { id: args.customerId },
    select: {
      id: true, ordersCount: true, totalSpent: true,
      consentStatus: true, hasApp: true, deletedAt: true,
    },
  });
  if (!customer || customer.deletedAt) return { enrolled: 0, skipped: 0 };

  let enrolled = 0, skipped = 0;
  for (const flow of flows) {
    // Entry filter from the preset: we look up the preset by trigger+name to
    // find filters that aren't persisted (presets are code, flows are DB).
    // It's cheap because there are O(20) presets.
    const preset = findPresetForFlow(flow.name, args.trigger);
    if (preset?.entryFilter && !matchesEntryFilter(preset.entryFilter, customer)) {
      skipped++;
      continue;
    }

    // Cooldown check: skip if customer already enrolled in last reEnrollCooldownH hours.
    if (flow.reEnrollCooldownH > 0) {
      const since = new Date(Date.now() - flow.reEnrollCooldownH * 3600_000);
      const recent = await prisma.flowEnrollment.findFirst({
        where: { flowId: flow.id, customerId: args.customerId, enrolledAt: { gte: since } },
        select: { id: true },
      });
      if (recent) { skipped++; continue; }
    }

    // First step determines initial nextRunAt — if it's a delay, schedule for then,
    // otherwise schedule for "now" so the tick runs the send immediately.
    const graph = flow.graph as unknown as FlowGraph;
    const firstStep = graph.steps[0];
    const initialDelayMs = firstStep?.type === "delay" ? firstStep.hours * 3600_000 : 0;

    await prisma.flowEnrollment.create({
      data: {
        flowId: flow.id,
        customerId: args.customerId,
        currentStep: firstStep?.type === "delay" ? 1 : 0,
        // If first step is a delay, mark it as consumed already so the tick starts at step 1.
        nextRunAt: new Date(Date.now() + initialDelayMs),
        context: (args.context ?? {}) as object,
      },
    });
    await prisma.flow.update({
      where: { id: flow.id },
      data: { lastTriggeredAt: new Date() },
    });
    enrolled++;
  }
  return { enrolled, skipped };
}

// Locate the preset behind a DB-persisted flow row. We don't store presetId on
// Flow (the graph is the source of truth post-creation), so we match by trigger
// and name-prefix instead. Returns undefined for custom flows authored by hand.
function findPresetForFlow(flowName: string, trigger: FlowTrigger) {
  // Flow names are created as "${preset.name} · ${store.name}" — strip the suffix.
  const namePart = flowName.split(" · ")[0];
  return FLOW_PRESETS.find((p) => p.trigger === trigger && p.name === namePart);
}

function matchesEntryFilter(filter: EntryFilter, customer: {
  ordersCount: number;
  totalSpent: { toNumber(): number } | number;
  consentStatus: string;
  hasApp: boolean;
}): boolean {
  const totalSpent = typeof customer.totalSpent === "number" ? customer.totalSpent : customer.totalSpent.toNumber();
  if (filter.ordersCountGte !== undefined && customer.ordersCount < filter.ordersCountGte) return false;
  if (filter.ordersCountLte !== undefined && customer.ordersCount > filter.ordersCountLte) return false;
  if (filter.totalSpentGte !== undefined && totalSpent < filter.totalSpentGte) return false;
  if (filter.consentRequired && customer.consentStatus !== "SUBSCRIBED") return false;
  if (filter.hasAppEq !== undefined && customer.hasApp !== filter.hasAppEq) return false;
  return true;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export async function tickDueEnrollments(limit = 100): Promise<{
  processed: number;
  sent: number;
  completed: number;
  failed: number;
  errors: string[];
}> {
  const due = await prisma.flowEnrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: new Date() } },
    include: {
      flow: { select: { id: true, name: true, graph: true, active: true, storeId: true } },
      customer: { select: {
        id: true, email: true, firstName: true, lastName: true, language: true,
        consentStatus: true, ordersCount: true, totalSpent: true, hasApp: true,
      } },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let sent = 0, completed = 0, failed = 0;
  const errors: string[] = [];

  for (const e of due) {
    try {
      // Flow could have been paused since enrollment — leave it alone.
      if (!e.flow.active) {
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: { status: "CANCELLED", completedAt: new Date(), lastError: "flow paused" },
        });
        continue;
      }
      // Consent check — never send to unsubscribed customers.
      if (e.customer.consentStatus === "UNSUBSCRIBED" || e.customer.consentStatus === "COMPLAINED") {
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: { status: "CANCELLED", completedAt: new Date(), lastError: `consent: ${e.customer.consentStatus}` },
        });
        continue;
      }

      const graph = e.flow.graph as unknown as FlowGraph;
      const step = graph.steps[e.currentStep];
      if (!step) {
        // Walked off the end → mark completed.
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        completed++;
        continue;
      }

      // Owner has paused this individual step → skip it cleanly and advance.
      // Disabled delays still consume their wait (we don't fast-forward time);
      // disabled sends/conditions become no-ops.
      if (step.enabled === false && step.type !== "delay") {
        const nextStepIdx = e.currentStep + 1;
        const next = graph.steps[nextStepIdx];
        const nextDelayMs = next?.type === "delay" && next.enabled !== false ? next.hours * 3600_000 : 0;
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: {
            currentStep: next?.type === "delay" ? nextStepIdx + 1 : nextStepIdx,
            nextRunAt: new Date(Date.now() + nextDelayMs),
          },
        });
        continue;
      }

      // Condition step: evaluate against the customer; on false, exit the flow.
      if (step.type === "condition") {
        const passes = evalCondition(step, e.customer);
        if (!passes) {
          await prisma.flowEnrollment.update({
            where: { id: e.id },
            data: { status: "CANCELLED", completedAt: new Date(), currentStep: e.currentStep, lastError: `condition failed: ${step.label}` },
          });
          continue;
        }
        // Condition passed → advance to next step immediately.
        const nextStepIdx = e.currentStep + 1;
        const nextAfterCondition = graph.steps[nextStepIdx];
        const nextDelayMs = nextAfterCondition?.type === "delay" ? nextAfterCondition.hours * 3600_000 : 0;
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: {
            currentStep: nextAfterCondition?.type === "delay" ? nextStepIdx + 1 : nextStepIdx,
            nextRunAt: new Date(Date.now() + nextDelayMs),
          },
        });
        continue;
      }

      const result = await runStep(step, e, e.flow.storeId);
      if (result.kind === "sent") sent++;

      // Advance to next step. If we've now exhausted the graph, complete.
      const nextStepIdx = e.currentStep + 1;
      const next = graph.steps[nextStepIdx];
      if (!next) {
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: { status: "COMPLETED", completedAt: new Date(), currentStep: nextStepIdx },
        });
        completed++;
      } else {
        // If the next step is a delay, schedule for now+delay; if it's another send, run it on
        // the next tick (nextRunAt = now). We deliberately don't chain multiple sends in one
        // tick — keeps the cron cheap and gives us natural backpressure.
        const nextDelayMs = next.type === "delay" ? next.hours * 3600_000 : 0;
        await prisma.flowEnrollment.update({
          where: { id: e.id },
          data: {
            currentStep: next.type === "delay" ? nextStepIdx + 1 : nextStepIdx,
            nextRunAt: new Date(Date.now() + nextDelayMs),
          },
        });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "tick failed";
      errors.push(`${e.id}: ${msg}`);
      // Push nextRunAt 30 min into the future so we don't hot-loop on the same broken row.
      // After 5 consecutive failures, give up.
      const lastErr = e.lastError ?? "";
      const failCount = (lastErr.match(/^retry-\d+/)?.[0]?.match(/\d+/)?.[0]) ?? "0";
      const n = parseInt(failCount, 10) + 1;
      await prisma.flowEnrollment.update({
        where: { id: e.id },
        data: n >= 5
          ? { status: "FAILED", completedAt: new Date(), lastError: `retry-${n}: ${msg.slice(0, 240)}` }
          : { nextRunAt: new Date(Date.now() + 30 * 60_000), lastError: `retry-${n}: ${msg.slice(0, 240)}` },
      }).catch(() => {});
    }
  }

  return { processed: due.length, sent, completed, failed, errors };
}

// ── Step execution ───────────────────────────────────────────────────────────

type StepResult = { kind: "sent" | "delayed" | "noop" };

async function runStep(step: FlowStep, enrollment: FlowEnrollment & {
  customer: { id: string; email: string; firstName: string | null; lastName: string | null; language: string | null };
}, storeId: string): Promise<StepResult> {
  if (step.type === "delay" || step.type === "condition") return { kind: "noop" };

  // type === "send" — render MJML, personalize, hit SES, record Send row.
  const [store, sender] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        name: true, storefrontUrl: true, brandPalette: true, defaultLanguage: true,
        legalName: true, legalAddress: true, legalCity: true, legalCountry: true,
        privacyUrl: true, supportEmail: true,
      },
    }),
    prisma.sender.findFirst({
      where: { storeId, active: true, verified: true },
      orderBy: [{ warmupStartedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    }),
  ]);

  if (!store) throw new Error(`store ${storeId} missing`);
  if (!sender) throw new Error(`no verified+active sender for store ${storeId}`);

  const palette = (store.brandPalette as { bg?: string; text?: string; primary?: string; accent?: string } | null) ?? {};
  const ctx: Record<string, string> = {
    "customer.firstName": enrollment.customer.firstName ?? "",
    "customer.lastName":  enrollment.customer.lastName ?? "",
    "customer.email":     enrollment.customer.email,
    "store.name":             store.name,
    "store.storefrontUrl":    store.storefrontUrl ?? "https://divainparfums.com",
    "store.bgColor":          palette.bg ?? "#FBF8F3",
    "store.textColor":        palette.text ?? "#0E0E0E",
    "store.primaryColor":     palette.primary ?? "#0E0E0E",
    "store.legalName":        store.legalName ?? "",
    "store.legalAddress":     store.legalAddress ?? "",
    "store.legalCity":        store.legalCity ?? "",
    "store.legalCountry":     store.legalCountry ?? "",
    "store.privacyUrl":       store.privacyUrl ?? "",
    "unsubscribeUrl":         `${process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space"}/api/unsubscribe?t=${encodeURIComponent(enrollment.customer.email)}`,
    "discountCode":           (enrollment.context as Record<string, string> | null)?.discountCode ?? "DIVAIN10",
    "abandonedCart.checkoutUrl": (enrollment.context as Record<string, string> | null)?.checkoutUrl ?? (store.storefrontUrl ?? "https://divainparfums.com"),
  };

  // Resolve subject + MJML via dotted-key mustache.
  const subject = personalizeDotted(step.subject, ctx).slice(0, 120);
  const mjml    = personalizeDotted(step.mjml, ctx);
  const { html } = renderMjml(mjml);

  const language = enrollment.customer.language ?? store.defaultLanguage ?? "es-ES";

  // Record Send row up-front so SES errors don't lose the audit trail.
  const send = await prisma.send.create({
    data: {
      flowId: enrollment.flowId,
      customerId: enrollment.customer.id,
      status: "QUEUED",
      language,
    },
  });

  try {
    const res = await sendEmail({
      from: `${sender.fromName} <${sender.fromEmail}>`,
      replyTo: sender.replyTo ?? undefined,
      to: enrollment.customer.email,
      subject,
      html,
      tags: [
        { name: "flow_id",     value: enrollment.flowId },
        { name: "enrollment",  value: enrollment.id },
        { name: "step",        value: String(enrollment.currentStep) },
      ],
      listUnsubscribe: { url: ctx.unsubscribeUrl, mailto: sender.replyTo ?? undefined },
    });
    await prisma.send.update({
      where: { id: send.id },
      data: { status: "SENT", sentAt: new Date(), messageId: res.messageId },
    });
    return { kind: "sent" };
  } catch (err) {
    await prisma.send.update({
      where: { id: send.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message.slice(0, 480) : "send failed" },
    });
    throw err;
  }
}

// Mustache replacement that supports dotted keys (e.g. {{customer.firstName}}).
// Whitespace around the key is tolerated. Unknown keys collapse to empty string.
function personalizeDotted(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => ctx[k] ?? "");
}

function evalCondition(step: FlowStepCondition, customer: {
  ordersCount: number;
  totalSpent: { toNumber(): number } | number;
  consentStatus: string;
  hasApp: boolean;
}): boolean {
  const fieldValue = (() => {
    switch (step.field) {
      case "customer.ordersCount":   return customer.ordersCount;
      case "customer.totalSpent":    return typeof customer.totalSpent === "number" ? customer.totalSpent : customer.totalSpent.toNumber();
      case "customer.consentStatus": return customer.consentStatus;
      case "customer.hasApp":        return customer.hasApp;
    }
  })();

  switch (step.op) {
    case "eq":  return fieldValue === step.value;
    case "neq": return fieldValue !== step.value;
    case "gte": return typeof fieldValue === "number" && typeof step.value === "number" && fieldValue >= step.value;
    case "lte": return typeof fieldValue === "number" && typeof step.value === "number" && fieldValue <= step.value;
    case "gt":  return typeof fieldValue === "number" && typeof step.value === "number" && fieldValue >  step.value;
    case "lt":  return typeof fieldValue === "number" && typeof step.value === "number" && fieldValue <  step.value;
  }
}
