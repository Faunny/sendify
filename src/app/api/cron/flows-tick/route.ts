// GET/POST /api/cron/flows-tick
//
// Drives the flow engine. Called by Vercel cron every 5 minutes (see vercel.json).
// Pulls every ACTIVE enrollment whose nextRunAt has passed and runs the next step
// (delay → schedule for later; send → render + SES + Send row).
//
// Auth: same pattern as the calendar cron — accepts Bearer CRON_SECRET OR an
// admin session (so the owner can hit "tick now" manually from the UI later).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tickDueEnrollments } from "@/lib/flows/engine";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authH = req.headers.get("authorization");
  if (cronSecret && authH === `Bearer ${cronSecret}`) return true;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await tickDueEnrollments(200);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "tick failed",
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
