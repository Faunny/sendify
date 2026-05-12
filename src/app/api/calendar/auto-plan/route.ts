// POST /api/calendar/auto-plan
//
// Triggers the auto-planner. Two callers:
//   - User clicking "Plan próximos 30 días" in /calendar (admin session)
//   - Vercel daily cron (Bearer CRON_SECRET, set in env)
//
// Returns the planned/skipped/failed report so the UI can show what happened.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { autoPlan } from "@/lib/pipeline/auto-plan";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function authorize(req: Request): Promise<boolean> {
  // Cron path: Vercel cron sets Authorization: Bearer <CRON_SECRET>.
  const cronSecret = process.env.CRON_SECRET;
  const auth_h = req.headers.get("authorization");
  if (cronSecret && auth_h === `Bearer ${cronSecret}`) return true;

  // User path: NextAuth session.
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { horizonDays?: number; storeSlug?: string }));
  const horizonDays = typeof body.horizonDays === "number" ? body.horizonDays : 30;
  const onlyStoreSlug = body.storeSlug;

  try {
    const result = await autoPlan({ horizonDays, onlyStoreSlug });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "auto-plan failed",
    }, { status: 500 });
  }
}

// GET also supported for Vercel cron compatibility (some cron triggers issue GET).
export async function GET(req: Request) {
  return POST(req);
}
