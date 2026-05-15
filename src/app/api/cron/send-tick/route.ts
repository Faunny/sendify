// GET/POST /api/cron/send-tick
//
// Vercel-cron entry to the pg-boss `sendify.send` queue. Pulls a bounded
// batch of queued sends, fires them at SES, and returns within Vercel's
// 300s function cap.
//
// This is the "drain the queue on a schedule" path because Vercel is
// serverless and can't host a long-lived worker. For higher throughput
// (>1k emails/min sustained) run `startSendWorker()` on Railway/Fly as a
// separate process — that path uses the same processOneSendJob() logic
// so behaviour is identical.
//
// Auth: Bearer CRON_SECRET (Vercel cron) OR admin session.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processSendBatch } from "@/lib/pipeline/send-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authH = req.headers.get("authorization");
  if (cronSecret && authH === `Bearer ${cronSecret}`) return true;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

// Max sends per tick. At ~14/s (SES rate limit default) a 4-min batch
// drains ~3,300 emails per cron call. The cron runs every minute, so
// burst capacity is comfortably 200k+/day without a dedicated worker.
const MAX_PER_TICK = 1500;

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processSendBatch({ max: MAX_PER_TICK });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[send-tick] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "send tick failed",
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
