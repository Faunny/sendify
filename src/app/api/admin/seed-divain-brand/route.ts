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

// Base divain brand kit — pulled from the Klaviyo flagship email. Applies
// across all four stores: same palette + same yellow accent + same trust
// commitments. Per-country differences (currency, service availability)
// override on top via PER_SLUG_OVERRIDES.
const DIVAIN_BASE = {
  primary: "#0E0E0E",
  bg: "#FBF8F3",
  text: "#1A1A1A",
  accent: "#FACD37",  // brand yellow
};

// Try & Buy — recurring service callout. ONLY available in Europe (Spain +
// UK) for now: the sample-on-packaging service is operated from the Alicante
// warehouse and not shipped internationally. USA + MX stores skip this block
// entirely (serviceCallout: null below) so we never advertise a service that
// can't be fulfilled in those markets.
const TRY_AND_BUY = {
  eyebrow:  "PRUEBA SIN RIESGO",
  title:    "¿Qué es Try&Buy?",
  body:     "Es nuestro servicio para probar la fragancia antes de decidir. Recibirás el perfume con una muestra en la parte superior del packaging para probarla antes de abrirlo. Si no te convence, puedes devolverlo.",
  ctaLabel: "IR A LA WEB",
};

// Per-store trust items + service callout. Source-language copy stays in
// Spanish (the translation pipeline fans out to local languages at send
// time). Currency thresholds reflect each market's local checkout config.
const PER_SLUG_KIT: Record<string, {
  trustItems: Array<{ label: string; sub?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceCallout: any | null;
}> = {
  "divain-europa": {
    trustItems: [
      { label: "Envío gratis",       sub: "A partir de 30€" },
      { label: "Devolución 30 días", sub: "Sin preguntas"   },
      { label: "Hecho en España",    sub: "Alicante · 2007" },
    ],
    serviceCallout: TRY_AND_BUY,
  },
  "divain-uk": {
    trustItems: [
      { label: "Free shipping",      sub: "Orders over £25"  },
      { label: "30-day returns",     sub: "No questions"     },
      { label: "Made in Spain",      sub: "Alicante · 2007"  },
    ],
    serviceCallout: TRY_AND_BUY,
  },
  "divain-usa": {
    trustItems: [
      { label: "Free shipping",      sub: "Orders over $35"  },
      { label: "30-day returns",     sub: "No questions"     },
      { label: "Made in Spain",      sub: "Alicante · 2007"  },
    ],
    serviceCallout: null, // Try&Buy not available outside Europe
  },
  "divain-mx": {
    trustItems: [
      { label: "Envío gratis",       sub: "Desde $499 MXN"  },
      { label: "Devolución 30 días", sub: "Sin preguntas"    },
      { label: "Hecho en España",    sub: "Alicante · 2007"  },
    ],
    serviceCallout: null, // Try&Buy not available outside Europe
  },
};

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    // Match any store whose slug contains "divain" (case-insensitive). This
    // handles slug variations (divain-europa vs divain-eu vs divain-es,
    // divain-uk vs divain-co-uk, etc.) without needing the user to keep
    // the seed route's hardcoded list in sync.
    const url = new URL(req.url);
    const slugParam = url.searchParams.get("slugs"); // optional override
    const stores = await prisma.store.findMany({
      where: slugParam
        ? { slug: { in: slugParam.split(",").map((s) => s.trim()).filter(Boolean) } }
        : { slug: { contains: "divain", mode: "insensitive" } },
      select: { id: true, slug: true, brandPalette: true },
    });

    if (stores.length === 0) {
      const all = await prisma.store.findMany({ select: { slug: true } });
      return NextResponse.json({
        ok: false,
        error: "no divain stores found",
        availableSlugs: all.map((s) => s.slug),
        hint: "pass ?slugs=slug-a,slug-b to target specific stores",
      }, { status: 404 });
    }

    const updates = await Promise.all(stores.map(async (store) => {
      // Pick the per-slug overrides if we have them, else fall back to a
      // safe Spanish-EU default. Unknown slugs still get the base palette.
      const slugKit = PER_SLUG_KIT[store.slug] ?? PER_SLUG_KIT["divain-europa"]!;
      const existing = (store.brandPalette ?? {}) as Record<string, unknown>;
      // Merge with whatever was already there so we don't clobber unrelated
      // fields someone might have set manually. For serviceCallout: if the
      // per-slug kit says null (US/MX), explicitly DELETE it from the merged
      // object so a previous seed run that set Try&Buy on US/MX gets wiped.
      const merged: Record<string, unknown> = {
        ...existing,
        primary:    DIVAIN_BASE.primary,
        bg:         DIVAIN_BASE.bg,
        text:       DIVAIN_BASE.text,
        accent:     DIVAIN_BASE.accent,
        trustItems: slugKit.trustItems,
      };
      if (slugKit.serviceCallout) {
        merged.serviceCallout = slugKit.serviceCallout;
      } else {
        delete merged.serviceCallout;
      }
      await prisma.store.update({
        where: { id: store.id },
        // Prisma's Json type expects InputJsonValue — Record<string, unknown>
        // doesn't structurally satisfy that. Cast through unknown so the
        // type-checker doesn't try (and fail) to verify the value shape.
        data:  { brandPalette: merged as unknown as object },
      });
      return {
        slug: store.slug,
        ok: true,
        hasServiceCallout: !!slugKit.serviceCallout,
        trustItemCount: slugKit.trustItems.length,
      };
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
