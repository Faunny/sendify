// POST /api/stores/[slug]/logo
//
// Uploads a logo image to the asset library and stores its URL on the Store
// row (Store.brandLogoUrl by default, brandLogoDarkUrl when ?dark=1). Used by
// the inline "Subir logo" affordance in the template editor.
//
// Body: { base64: string, mimeType?: string, name?: string }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const url = new URL(req.url);
  const isDark = url.searchParams.get("dark") === "1";

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const base64 = typeof body.base64 === "string" ? body.base64 : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/png";
  const name = (typeof body.name === "string" && body.name.trim()) || `${slug}-logo${isDark ? "-dark" : ""}`;

  if (!base64) return NextResponse.json({ ok: false, error: "base64 required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

  try {
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) return NextResponse.json({ ok: false, error: "empty image" }, { status: 400 });
    if (bytes.length > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "logo too large (>5MB)" }, { status: 400 });

    const asset = await prisma.asset.create({
      data: {
        name: name.slice(0, 200),
        kind: "IMAGE",
        mimeType,
        data: new Uint8Array(bytes),
        sizeBytes: bytes.length,
        tags: ["brand-logo", slug, isDark ? "logo-dark" : "logo-light"],
        generatedBy: "manual:brand-upload",
      },
      select: { id: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
    const logoUrl = `${appUrl}/api/assets/${asset.id}`;

    await prisma.store.update({
      where: { id: store.id },
      data: isDark ? { brandLogoDarkUrl: logoUrl } : { brandLogoUrl: logoUrl },
    });

    return NextResponse.json({ ok: true, url: logoUrl, isDark });
  } catch (e) {
    console.error("[POST /api/stores/[slug]/logo] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "upload failed",
    }, { status: 500 });
  }
}
