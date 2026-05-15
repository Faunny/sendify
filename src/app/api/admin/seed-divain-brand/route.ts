// One-shot route: seeds the divain stores' brandPalette JSON with the real
// brand kit (accent yellow, trust items, Try & Buy service callout). Call
// once after deploying the v9+ template skeletons so the new blocks actually
// render with real divain content.
//
// Auth: Bearer CRON_SECRET (so curl --header "Authorization: Bearer $SECRET"
// works from anywhere) OR admin session. Idempotent — running it twice
// produces the same result.
//
//   curl -X POST https://sendify.divain.space/api/admin/seed-divain-brand \
//        -H "Authorization: Bearer $CRON_SECRET"

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authH = req.headers.get("authorization");
  if (cronSecret && authH === `Bearer ${cronSecret}`) return true;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(session?.user as any)?.id;
}

// Real divain brand kit — pulled from the Klaviyo flagship email the user
// shared. Yellow is the brand accent, trust items are divain-specific, and
// the Try & Buy service callout is divain's recurring promo block.
const DIVAIN_BRAND_KIT = {
  // Pinned monochrome palette stays — only the accent is non-black.
  primary: "#0E0E0E",
  bg: "#FBF8F3",
  text: "#1A1A1A",
  // Yellow accent — used for buttons in product-narrative + the bg of the
  // service callout. Matches the divain Klaviyo flagship.
  accent: "#FACD37",
  // Trust band — three short policy claims that show beneath every email.
  trustItems: [
    { label: "Envío gratis",       sub: "A partir de 30€" },
    { label: "Devolución 30 días", sub: "Sin preguntas"   },
    { label: "Hecho en España",    sub: "Alicante · 2007" },
  ],
  // Try & Buy — the recurring service callout the user wants in their emails.
  // Matches the yellow box at the bottom of the divain Klaviyo flagship.
  serviceCallout: {
    eyebrow:  "PRUEBA SIN RIESGO",
    title:    "¿Qué es Try&Buy?",
    body:     "Es nuestro servicio para probar la fragancia antes de decidir. Recibirás el perfume con una muestra en la parte superior del packaging para probarla antes de abrirlo. Si no te convence, puedes devolverlo.",
    ctaLabel: "IR A LA WEB",
    // ctaUrl is filled per-store from storefrontUrl at render time.
  },
} as const;

// Divain stores by slug — these are the four real Shopify Plus storefronts
// from the project memory (divain-europa = .com, divain-uk = .co.uk,
// divain-usa = .co — note .co not .com — divain-mx).
const DIVAIN_STORE_SLUGS = ["divain-europa", "divain-uk", "divain-usa", "divain-mx"];

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const stores = await prisma.store.findMany({
      where: { slug: { in: DIVAIN_STORE_SLUGS } },
      select: { id: true, slug: true, brandPalette: true },
    });

    if (stores.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "no divain stores found",
        expectedSlugs: DIVAIN_STORE_SLUGS,
      }, { status: 404 });
    }

    const updates = await Promise.all(stores.map(async (store) => {
      // Merge with whatever was already there so we don't clobber unrelated
      // fields someone might have set manually (rare, but defensive).
      const existing = (store.brandPalette ?? {}) as Record<string, unknown>;
      const merged = {
        ...existing,
        primary:        DIVAIN_BRAND_KIT.primary,
        bg:             DIVAIN_BRAND_KIT.bg,
        text:           DIVAIN_BRAND_KIT.text,
        accent:         DIVAIN_BRAND_KIT.accent,
        trustItems:     DIVAIN_BRAND_KIT.trustItems,
        serviceCallout: DIVAIN_BRAND_KIT.serviceCallout,
      };
      await prisma.store.update({
        where: { id: store.id },
        data:  { brandPalette: merged },
      });
      return { slug: store.slug, ok: true };
    }));

    return NextResponse.json({ ok: true, stores: updates });
  } catch (e) {
    console.error("[seed-divain-brand] failed:", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "seed failed",
    }, { status: 500 });
  }
}

// Allow GET too (admin convenience — just visit the URL while logged in).
export async function GET(req: Request) {
  return POST(req);
}
