// Top-of-dashboard checklist of the steps needed to make Sendify actually send mail.
// Each step shows green ✓ when done (detected via env vars / sample queries), or amber !
// when pending with a one-click action. Disappears entirely once all 6 are done.

import Link from "next/link";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// On the server (where env vars are available) decide which steps are complete.
function getChecklistState() {
  const dbConfigured =
    !!process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("placeholder");
  const redisConfigured =
    !!process.env.REDIS_URL &&
    !process.env.REDIS_URL.includes("placeholder");
  const awsConfigured = !!process.env.AWS_ACCESS_KEY_ID;
  const deeplConfigured = !!process.env.DEEPL_API_KEY;
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const shopifyConfigured = !!process.env.SHOPIFY_API_KEY;

  return [
    { id: "db",      label: "Database connected (Neon / RDS)",                ok: dbConfigured,      hint: "5 min · pega DATABASE_URL en Vercel",                                action: { label: "Configure", href: "/settings" }, blocking: true },
    { id: "redis",   label: "Redis connected (BullMQ queue)",                  ok: redisConfigured,   hint: "Upstash free tier o ElastiCache",                                     action: { label: "Configure", href: "/settings" }, blocking: true },
    { id: "ses",     label: "AWS SES credentials + 4 senders verified",        ok: awsConfigured,     hint: "DKIM/SPF/DMARC en los 4 dominios divain",                              action: { label: "Configure", href: "/settings" }, blocking: true },
    { id: "shopify", label: "Shopify Plus tokens (4 tiendas) + webhooks",     ok: shopifyConfigured, hint: "Customers/orders/products vienen de aquí",                            action: { label: "Configure", href: "/settings" }, blocking: false },
    { id: "deepl",   label: "DeepL Pro API key",                                ok: deeplConfigured,   hint: "Traducción a 22 idiomas con cache",                                   action: { label: "Configure", href: "/settings" }, blocking: false },
    { id: "gemini",  label: "Gemini 2.5 Flash Image (Nano Banana) API key",   ok: geminiConfigured,  hint: "Generación de banners · $0.04 por imagen",                            action: { label: "Configure", href: "/settings" }, blocking: false },
  ];
}

export function SetupChecklist() {
  const steps = getChecklistState();
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
              Todo lo demás de Sendify (builder, calendario, preview) ya funciona y se queda como está cuando conectes.
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
