// SES warm-up scheduler.
//
// Mailbox providers (Gmail, Outlook, Yahoo, Apple) treat unfamiliar sender domains as
// suspect. Sending 1.5M emails from a fresh domain → instant spam folder, instant block.
// The fix: ramp daily volume gradually over ~14 days so each provider sees stable,
// growing traffic with low complaint rate.
//
// This module is the single source of truth for "how many emails can sender X send today?"
// Every place that resolves an audience MUST consult dailySendCap() before queuing sends.
//
// Curve: the industry-standard 14-day ramp from "new sender" to "full volume", borrowing
// from Mailgun + Amazon SES guidance.

export type WarmupSender = {
  warmupStartedAt: Date | null;
  warmupTargetPerDay: number;
  dailyCap: number; // hard anti-saturation ceiling, unrelated to warm-up
};

// Day-N → fraction of warmupTargetPerDay you can send. Day 1 = 50 emails minimum
// (regardless of target), then doubles roughly daily until the target is reached.
// We clamp using absolute floors AND target-relative fractions so the curve also
// works for small senders (e.g. a 50k/day target ramp).
const CURVE: Array<{ day: number; absolute: number; fraction: number }> = [
  { day: 1,  absolute:      50, fraction: 0.0001 },
  { day: 2,  absolute:     100, fraction: 0.0002 },
  { day: 3,  absolute:     500, fraction: 0.001  },
  { day: 4,  absolute:   1_000, fraction: 0.002  },
  { day: 5,  absolute:   5_000, fraction: 0.008  },
  { day: 6,  absolute:  10_000, fraction: 0.015  },
  { day: 7,  absolute:  20_000, fraction: 0.03   },
  { day: 8,  absolute:  40_000, fraction: 0.06   },
  { day: 9,  absolute:  70_000, fraction: 0.10   },
  { day: 10, absolute: 100_000, fraction: 0.15   },
  { day: 11, absolute: 150_000, fraction: 0.22   },
  { day: 12, absolute: 250_000, fraction: 0.40   },
  { day: 13, absolute: 400_000, fraction: 0.65   },
  { day: 14, absolute: Infinity, fraction: 1.0   }, // fully warmed
];

export const WARMUP_DAYS = CURVE.length;

// Returns the maximum number of emails this sender can send today.
// Day 0 = sender hasn't started warm-up (warmupStartedAt is in the future) → 0.
// After day 14 = fully warmed → dailyCap (the absolute ceiling).
// During ramp → min(absolute floor, fraction × target).
export function dailySendCap(sender: WarmupSender, now: Date = new Date()): number {
  // Sender never started warm-up — treat as fully warmed (legacy domains).
  if (!sender.warmupStartedAt) return sender.dailyCap;

  const day = Math.floor((now.getTime() - sender.warmupStartedAt.getTime()) / 86_400_000) + 1;
  if (day < 1) return 0;                          // future-dated start
  if (day >= WARMUP_DAYS) return sender.dailyCap; // fully warmed → cap at the anti-saturation hard ceiling

  const point = CURVE[day - 1];
  const fromFraction = Math.floor(sender.warmupTargetPerDay * point.fraction);
  const fromAbsolute = point.absolute;
  // Use whichever is *larger* — the absolute floor protects small targets, the fraction
  // protects large targets from over-shooting on day 14.
  const limit = Math.min(Math.max(fromFraction, fromAbsolute), sender.dailyCap);
  return limit;
}

// Returns the current ramp stage (1..14) or 0 if not started, or "warmed" if past day 14.
export function warmupStage(sender: WarmupSender, now: Date = new Date()): number | "warmed" {
  if (!sender.warmupStartedAt) return "warmed";
  const day = Math.floor((now.getTime() - sender.warmupStartedAt.getTime()) / 86_400_000) + 1;
  if (day < 1) return 0;
  if (day >= WARMUP_DAYS) return "warmed";
  return day;
}

// When (calendar day) will this sender be fully warmed?
export function warmupCompletionDate(sender: WarmupSender): Date | null {
  if (!sender.warmupStartedAt) return null;
  const d = new Date(sender.warmupStartedAt);
  d.setUTCDate(d.getUTCDate() + WARMUP_DAYS);
  return d;
}

// Full curve for the senders settings chart.
export function curvePoints(targetPerDay: number, hardCap: number) {
  return CURVE.map((p) => ({
    day: p.day,
    limit: Math.min(Math.max(Math.floor(targetPerDay * p.fraction), p.absolute), hardCap),
  }));
}

// Caps a recipient list at the warm-up budget. Returns the recipients that fit + the count dropped.
// Stable sort: deterministic ordering (e.g. by customerId) so re-runs target the same first-N.
export function capByWarmup<T extends { customerId: string }>(
  recipients: T[],
  sender: WarmupSender,
  now: Date = new Date(),
): { allowed: T[]; deferred: T[] } {
  const cap = dailySendCap(sender, now);
  if (recipients.length <= cap) return { allowed: recipients, deferred: [] };
  const sorted = [...recipients].sort((a, b) => a.customerId.localeCompare(b.customerId));
  return { allowed: sorted.slice(0, cap), deferred: sorted.slice(cap) };
}
