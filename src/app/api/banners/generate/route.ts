// POST /api/banners/generate
//
// Generates a hero banner via Gemini 2.5 Flash Image and persists it as an
// Asset row with raw bytes inline (no S3 needed yet). Returns the public URL
// the MJML can embed in <mj-image src="...">.
//
// Body: { prompt, palette?, aspectRatio?, name?, tags? }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBanner } from "@/lib/gemini";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length < 10) {
    return NextResponse.json({ ok: false, error: "prompt too short (need ≥10 chars)" }, { status: 400 });
  }
  const aspectRatio = (body.aspectRatio as "1:1" | "16:9" | "3:2" | "9:16" | undefined) ?? "3:2";
  const name = (body.name as string | undefined) ?? `banner-${Date.now()}`;
  const tags = (body.tags as string[] | undefined) ?? ["ai-generated"];
  const palette = body.palette as string[] | undefined;

  let img;
  try {
    img = await generateBanner({
      prompt,
      aspectRatio,
      brandHints: { palette, style: "editorial lifestyle photography, divain perfume brand" },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 300) : "Gemini failed",
    }, { status: 502 });
  }

  const bytes = Buffer.from(img.base64, "base64");
  const asset = await prisma.asset.create({
    data: {
      name,
      kind: "IMAGE",
      mimeType: img.mimeType,
      data: bytes,
      sizeBytes: bytes.length,
      tags,
      prompt,
      generatedBy: "gemini-2.5-flash-image",
    },
    select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
  return NextResponse.json({
    ok: true,
    assetId: asset.id,
    url: `${appUrl}/api/assets/${asset.id}`,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  });
}
