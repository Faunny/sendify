// POST /api/templates/[id]/render
//
// Live MJML → HTML compile for the editor's right-side preview. Takes the
// current MJML from the request body (so the user sees their unsaved edits
// rendered) and returns compiled HTML + warnings. NO DB write.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderMjml } from "@/lib/mjml";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as { mjml?: string }));
  const mjml = typeof body.mjml === "string" ? body.mjml : "";
  if (!mjml.includes("<mjml")) {
    return NextResponse.json({ ok: false, error: "mjml looks empty or invalid" }, { status: 400 });
  }
  try {
    const { html, hash, errors } = renderMjml(mjml);
    return NextResponse.json({ ok: true, html, hash, errors });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "render failed" }, { status: 500 });
  }
}
