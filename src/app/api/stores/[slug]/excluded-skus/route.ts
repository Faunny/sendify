// PATCH /api/stores/[slug]/excluded-skus  body: { patterns: string[] }
//
// Update the comma/Enter-separated SKU-pattern list used by the AI template
// generator to drop non-perfume products (BOLSA, MUESTRA, DIV-, etc).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { productExcludedSkuPatterns: true },
  }).catch(() => null);
  return NextResponse.json({ ok: true, patterns: store?.productExcludedSkuPatterns ?? [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const body = await req.json().catch(() => ({} as { patterns?: unknown }));
  const raw: unknown[] = Array.isArray(body.patterns) ? body.patterns : [];
  // Normalise: trim, dedupe, drop empties. Keep case as-typed so the user can
  // read it back; the matcher itself is case-insensitive.
  const patterns: string[] = Array.from(new Set(
    raw.map((p: unknown) => String(p).trim()).filter((p: string) => p.length > 0 && p.length < 80),
  )).slice(0, 50);

  try {
    const store = await prisma.store.update({
      where: { slug },
      data: { productExcludedSkuPatterns: patterns },
      select: { slug: true, productExcludedSkuPatterns: true },
    });
    return NextResponse.json({ ok: true, store });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "update failed",
    }, { status: 500 });
  }
}
