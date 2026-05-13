// GET  /api/assets       — list assets (filters: tags, kind, used/unused)
// POST /api/assets       — upload a new asset (used by external agents to drop
//                          generated images into the shared library)
//
// POST body accepts either:
//   { name, tags[], notes?, base64, mimeType }
//   { name, tags[], notes?, url }            (Sendify will fetch + store)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await auth();
  // External agents authenticate via Bearer token (env ASSET_LIBRARY_TOKEN).
  const bearer = req.headers.get("authorization");
  const tokenOk = bearer && process.env.ASSET_LIBRARY_TOKEN && bearer === `Bearer ${process.env.ASSET_LIBRARY_TOKEN}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id && !tokenOk) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all"; // all | unused | used
  const tag    = url.searchParams.get("tag");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "60", 10) || 60, 200);

  const where = {
    ...(filter === "unused" && { usedCount: 0 }),
    ...(filter === "used"   && { usedCount: { gt: 0 } }),
    ...(tag && { tags: { has: tag } }),
  };

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [{ usedCount: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true, name: true, kind: true, mimeType: true, tags: true, prompt: true,
      generatedBy: true, usedCount: true, lastUsedAt: true, notes: true, createdAt: true,
      width: true, height: true, sizeBytes: true, url: true,
    },
  });

  const total = await prisma.asset.count();
  const unused = await prisma.asset.count({ where: { usedCount: 0 } });

  return NextResponse.json({
    ok: true,
    assets: assets.map((a) => ({ ...a, serveUrl: `/api/assets/${a.id}` })),
    counts: { total, unused, used: total - unused },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const bearer = req.headers.get("authorization");
  const tokenOk = bearer && process.env.ASSET_LIBRARY_TOKEN && bearer === `Bearer ${process.env.ASSET_LIBRARY_TOKEN}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id && !tokenOk) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(body.name ?? `asset-${Date.now()}`).slice(0, 200);
  const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : [];
  const notes = body.notes ? String(body.notes).slice(0, 500) : null;
  const generatedBy = body.generatedBy ? String(body.generatedBy).slice(0, 80) : (tokenOk ? "agent:external" : "manual");
  const prompt = body.prompt ? String(body.prompt).slice(0, 800) : null;

  let bytes: Buffer | null = null;
  let mimeType = String(body.mimeType ?? "image/png");

  if (typeof body.base64 === "string" && body.base64.length > 0) {
    bytes = Buffer.from(body.base64, "base64");
  } else if (typeof body.url === "string" && /^https?:\/\//.test(body.url)) {
    try {
      const r = await fetch(body.url, { redirect: "follow" });
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const ab = await r.arrayBuffer();
      bytes = Buffer.from(ab);
      mimeType = r.headers.get("content-type") ?? mimeType;
    } catch (e) {
      return NextResponse.json({ ok: false, error: `failed to fetch ${body.url}: ${e instanceof Error ? e.message : "?"}` }, { status: 400 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "need base64 or url" }, { status: 400 });
  }

  if (!bytes || bytes.length === 0) return NextResponse.json({ ok: false, error: "empty image bytes" }, { status: 400 });
  if (bytes.length > 12 * 1024 * 1024) return NextResponse.json({ ok: false, error: "asset too large (>12MB)" }, { status: 400 });

  const asset = await prisma.asset.create({
    data: {
      name, kind: "IMAGE", mimeType, data: new Uint8Array(bytes), sizeBytes: bytes.length,
      tags, notes, prompt, generatedBy,
    },
    select: { id: true, name: true, mimeType: true, tags: true, sizeBytes: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
  return NextResponse.json({
    ok: true,
    asset,
    serveUrl: `${appUrl}/api/assets/${asset.id}`,
  });
}
