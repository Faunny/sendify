// PATCH /api/stores/[id]/brand
//
// Updates a single Store's brand kit (palette, logos, trust items, service
// callout, brand descriptor). Designed for the /settings/brand editor so the
// owner can configure each tenant without touching the DB directly.
//
// Body shape (all optional, missing fields preserved):
//   {
//     brandLogoUrl?: string,
//     brandLogoDarkUrl?: string,
//     palette?: { primary?, accent?, bg?, text? },
//     trustItems?: Array<{ label, sub? }>,
//     serviceCallout?: { eyebrow?, title, body, ctaLabel, ctaUrl? } | null,
//     brandDescriptor?: string,
//   }
//
// Returns the updated Store (lite) + the merged brandPalette JSON.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

type BrandPayload = {
  brandLogoUrl?: string | null;
  brandLogoDarkUrl?: string | null;
  palette?: { primary?: string; accent?: string; bg?: string; text?: string };
  trustItems?: Array<{ label?: string; sub?: string }>;
  serviceCallout?: { eyebrow?: string; title?: string; body?: string; ctaLabel?: string; ctaUrl?: string } | null;
  brandDescriptor?: string;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Session-only — this endpoint mutates store config so we require a logged-
  // in admin. No CRON_SECRET bypass on purpose.
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: BrandPayload;
  try {
    body = await req.json() as BrandPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Pull the existing brandPalette JSON so we MERGE instead of overwriting.
  // The seed route + the LLM both rely on this column carrying multiple
  // unrelated keys (trustItems, accent, serviceCallout, brandDescriptor).
  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, brandPalette: true, brandLogoUrl: true, brandLogoDarkUrl: true },
  });
  if (!store) {
    return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });
  }
  const existing = (store.brandPalette ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing };

  // Palette — validate each colour individually so a single typo doesn't
  // poison the whole save (the editor sends 4 colours per save).
  if (body.palette) {
    const p = body.palette;
    for (const key of ["primary", "accent", "bg", "text"] as const) {
      const v = p[key];
      if (typeof v === "string" && HEX_RE.test(v)) {
        merged[key] = v;
      } else if (v !== undefined) {
        return NextResponse.json({ ok: false, error: `invalid hex color: ${key}=${v}` }, { status: 400 });
      }
    }
  }

  if (Array.isArray(body.trustItems)) {
    merged.trustItems = body.trustItems
      .filter((it): it is { label?: string; sub?: string } => typeof it === "object" && it !== null)
      .map((it) => ({
        label: typeof it.label === "string" ? it.label.slice(0, 40) : "",
        sub:   typeof it.sub   === "string" ? it.sub.slice(0, 50)   : undefined,
      }))
      .filter((it) => it.label.length > 0)
      .slice(0, 3);
  }

  if (body.serviceCallout === null) {
    delete merged.serviceCallout;
  } else if (body.serviceCallout && typeof body.serviceCallout === "object") {
    const sc = body.serviceCallout;
    if (typeof sc.title === "string" && typeof sc.body === "string" && typeof sc.ctaLabel === "string") {
      merged.serviceCallout = {
        eyebrow:  typeof sc.eyebrow === "string" ? sc.eyebrow.slice(0, 60) : undefined,
        title:    sc.title.slice(0, 80),
        body:     sc.body.slice(0, 360),
        ctaLabel: sc.ctaLabel.toUpperCase().slice(0, 30),
        ctaUrl:   typeof sc.ctaUrl === "string" ? sc.ctaUrl : undefined,
      };
    }
  }

  if (typeof body.brandDescriptor === "string") {
    merged.brandDescriptor = body.brandDescriptor.slice(0, 180);
  }

  // Logo columns live on Store directly (not inside the JSON). Update them
  // separately. Setting to null clears them; undefined keeps the existing.
  const logoUpdates: { brandLogoUrl?: string | null; brandLogoDarkUrl?: string | null } = {};
  if (body.brandLogoUrl !== undefined)     logoUpdates.brandLogoUrl     = body.brandLogoUrl;
  if (body.brandLogoDarkUrl !== undefined) logoUpdates.brandLogoDarkUrl = body.brandLogoDarkUrl;

  const updated = await prisma.store.update({
    where: { id },
    data: {
      brandPalette: merged as unknown as object,
      ...logoUpdates,
    },
    select: {
      id: true, slug: true, name: true,
      brandPalette: true, brandLogoUrl: true, brandLogoDarkUrl: true,
    },
  });

  return NextResponse.json({ ok: true, store: updated });
}
