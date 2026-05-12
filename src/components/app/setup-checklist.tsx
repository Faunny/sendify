// Setup checklist on the dashboard. Each item is green when the matching credential
// (or DB state) exists, amber when pending. The whole card disappears once everything
// is configured.

import Link from "next/link";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

type Step = { id: string; label: string; hint: string; ok: boolean; action: { label: string; href: string }; blocking: boolean };

async function getChecklistState(): Promise<Step[]> {
  // DB itself — if we can count Sender rows, the connection works.
  let dbOk = false;
  let senderCount = 0, shopifyConnectedCount = 0;
  const credCounts: Record<string, number> = {};
  try {
    senderCount = await prisma.sender.count();
    dbOk = true;
    shopifyConnectedCount = await prisma.providerCredential.count({ where: { provider: "SHOPIFY", active: true } });
    const credRows = await prisma.providerCredential.findMany({
      where: { active: true },
      select: { provider: true, scope: true },
    });
    for (const r of credRows) credCounts[r.provider] = (credCounts[r.provider] ?? 0) + 1;
  } catch { /* DB unreachable */ }

  const hasAnyTranslation = (credCounts.TRANSLATION_DEEPSEEK ?? 0) > 0
                         || (credCounts.TRANSLATION_OPENAI ?? 0) > 0
                         || (credCounts.TRANSLATION_DEEPL ?? 0) > 0;
  const hasAnyImage = (credCounts.IMAGE_GEMINI ?? 0) > 0
                   || (credCounts.IMAGE_OPENAI ?? 0) > 0;

  return [
    { id: "db",          label: "Database connected (Neon)",          ok: dbOk,                          hint: "DATABASE_URL en Vercel · Postgres 16 con 20 tablas",                       action: { label: "Configure", href: "/settings" }, blocking: true },
    { id: "shopify",     label: `Shopify Plus tokens (${shopifyConnectedCount}/4 conectadas)`, ok: shopifyConnectedCount >= 4, hint: "Una Custom App por tienda · scopes read_customers/orders/products",       action: { label: "Connect", href: "/settings" },   blocking: true },
    { id: "ses",         label: "AWS SES + 4 senders verified",       ok: senderCount > 0 && shopifyConnectedCount === 4, /* placeholder until real SES verification check */ hint: "DKIM/SPF/DMARC en los 4 dominios divain",                                    action: { label: "Configure", href: "/settings" }, blocking: true },
    { id: "translation", label: "Translation engine (DeepSeek o OpenAI)", ok: hasAnyTranslation,        hint: "Necesario para fan-out a 22 idiomas. DeepSeek = más barato",               action: { label: "Configure", href: "/settings" }, blocking: false },
    { id: "image",       label: "AI image generation (Gemini o DALL-E)", ok: hasAnyImage,                hint: "Genera banners desde el builder con la paleta de marca",                  action: { label: "Configure", href: "/settings" }, blocking: false },
    { id: "promo",       label: "Promotion webhook secret",           ok: (credCounts.PROMOTIONS_WEBHOOK_SECRET ?? 0) > 0, hint: "Comparte con tu proyecto externo de calendario para auto-drafts",          action: { label: "Configure", href: "/settings" }, blocking: false },
  ];
}

export async function SetupChecklist() {
  const steps = await getChecklistState();
  const remaining = steps.filter((s) => !s.ok);
  if (remaining.length === 0) return null;
  const blockers = remaining.filter((s) => s.blocking).length;

  return (
    <Card className="border-[color:var(--warning)]/30 bg-[color-mix(in_oklch,var(--warning)_4%,transparent)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-[color:var(--warning)]" />
              <h2 className="text-[15px] font-medium">Setup pendiente</h2>
              {blockers > 0 && <Badge variant="warning">{blockers} bloqueantes</Badge>}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Hasta completar las piezas bloqueantes, los botones de envío y aprobación no pueden persistir nada.
              Todo lo demás de Sendify (builder, calendario, preview) ya funciona y se queda igual cuando conectes.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${
                s.ok ? "border-border bg-card/40" : s.blocking ? "border-[color:var(--warning)]/40 bg-card/40" : "border-border bg-card/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`grid h-5 w-5 place-items-center rounded-full shrink-0 ${
                  s.ok
                    ? "bg-[color:var(--positive)]/15 text-[color:var(--positive)]"
                    : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
                }`}>
                  {s.ok ? <Check className="h-3 w-3" /> : <span className="text-[10px]">!</span>}
                </span>
                <div className="min-w-0">
                  <div className={`text-[12px] ${s.ok ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.hint}</div>
                </div>
              </div>
              {!s.ok && (
                <Link
                  href={s.action.href}
                  className="text-[11px] text-[color:var(--accent)] hover:underline flex items-center gap-0.5 shrink-0"
                >
                  {s.action.label} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
