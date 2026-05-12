// GET  /api/forms                 — list forms
// POST /api/forms                 — create a form
//
// Body for create:
//   { name, kind?, storeSlug?, fields?, design?, behavior? }
// Defaults to a single-email opt-in form if fields omitted.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_FIELDS = [
  { id: "email", type: "email", label: "Email", placeholder: "tu@email.com", required: true },
  { id: "consent", type: "consent", label: "Acepto recibir comunicaciones de divain. Puedo darme de baja en cualquier momento.", required: true },
];

const DEFAULT_DESIGN = {
  headline: "−10% en tu primer pedido",
  subheadline: "Suscríbete y recibe el código en 1 minuto.",
  ctaLabel: "Suscribirme",
  theme: "minimal",            // minimal | lifestyle
  palette: { bg: "#FFFFFF", text: "#1A1A1A", primary: "#000000" },
  backgroundImageUrl: null,
};

const DEFAULT_BEHAVIOR = {
  successMessage: "¡Gracias! Revisa tu inbox.",
  successRedirectUrl: null,
  doubleOptIn: false,
  popupTrigger: null,          // { kind: "exit-intent" } | { kind: "delay", value: 8000 }
};

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `form-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const forms = await prisma.form.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, name: true, kind: true, status: true,
      impressions: true, submissions: true, updatedAt: true,
      store: { select: { name: true, slug: true } },
    },
  });
  return NextResponse.json({ ok: true, forms });
}

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(body.name ?? "").trim() || "Nuevo formulario";
  const kind = (body.kind as "EMBED" | "POPUP" | "INLINE" | "HOSTED" | undefined) ?? "EMBED";
  const storeSlug = body.storeSlug as string | undefined;
  const fields    = body.fields   ?? DEFAULT_FIELDS;
  const design    = body.design   ?? DEFAULT_DESIGN;
  const behavior  = body.behavior ?? DEFAULT_BEHAVIOR;

  let slug = slugify(name);
  // Ensure unique slug — append a random suffix if taken.
  while (await prisma.form.findUnique({ where: { slug } })) {
    slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const store = storeSlug
    ? await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } })
    : null;

  try {
    const form = await prisma.form.create({
      data: {
        storeId: store?.id ?? null,
        slug,
        name,
        kind,
        status: "DRAFT",
        fields: fields as Prisma.InputJsonValue,
        design: design as Prisma.InputJsonValue,
        behavior: behavior as Prisma.InputJsonValue,
        tagsOnSubmit: [],
        segmentIds: [],
      },
    });
    return NextResponse.json({ ok: true, form });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "create failed",
    }, { status: 500 });
  }
}
