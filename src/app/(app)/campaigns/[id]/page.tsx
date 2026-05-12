import Link from "next/link";
import { ArrowLeft, FileQuestion, Calendar as CalendarIcon, Clock, Mail, Languages as LanguagesIcon, Users, Sparkles, AlertCircle, Check } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmailPreviewSwitcher } from "@/components/app/email-preview-switcher";
import { CampaignActions } from "@/components/app/campaign-actions";
import { SendingMonitor } from "@/components/app/sending-monitor";
import { EmptyState } from "@/components/app/empty-state";
import { prisma } from "@/lib/db";
import { LANGUAGES } from "@/lib/languages";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { estimateCampaignCost } from "@/lib/cost";
import { hasCredential } from "@/lib/credentials";

// Real campaign detail page. Renders:
//   - Header with status + scheduled date + source
//   - Email preview with language switcher (flips through all variants)
//   - Subject + preheader inline editor
//   - Pre-flight checklist (what's missing to actually send) + Approve/Cancel/Test send
//   - Audience summary (linked segments + estimated count)
//   - Live SendingMonitor when status=SENDING

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      store: true,
      sender: true,
      variants: { select: { id: true, language: true, subject: true } },
    },
  }).catch(() => null);

  if (!campaign) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
        </Button>
        <EmptyState
          icon={<FileQuestion className="h-5 w-5" />}
          title="Campaña no encontrada"
          description="Esta campaña no existe en la DB o ya fue eliminada."
          primaryAction={{ label: "Volver a campañas", href: "/campaigns" }}
        />
      </div>
    );
  }

  // Pre-flight checklist: which infra pieces are missing before this could actually send?
  const [hasTranslation, hasSes, hasShopify] = await Promise.all([
    Promise.all([
      hasCredential("TRANSLATION_DEEPSEEK"),
      hasCredential("TRANSLATION_OPENAI"),
      hasCredential("TRANSLATION_DEEPL"),
    ]).then((arr) => arr.some(Boolean)),
    hasCredential("AWS_SES"),
    hasCredential("SHOPIFY", campaign.store.slug),
  ]);

  // Recompute cost so it reflects current settings (cached translations etc.)
  const cost = estimateCampaignCost({
    recipients: campaign.estimatedRecipients,
    languages: Math.max(1, campaign.variants.length),
    avgCharsPerLanguage: 2000,
    cacheHitRate: 0.0,
    imagesGenerated: 1,
  });

  const availableLanguages = campaign.variants.length > 0
    ? campaign.variants.map((v) => v.language)
    : [campaign.store.defaultLanguage];

  // The variant's subject overrides the campaign-level subject when shown for that language
  // (in production the translation pipeline writes per-variant subjects). For the demo
  // they're often identical because we seeded a single source subject.

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
        </Button>
        <PageHeader
          meta={
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono">{campaign.id}</span>
              <span>·</span>
              <span>{campaign.store.name}</span>
              <span>·</span>
              <StatusBadge status={campaign.status} />
            </div>
          }
          title={campaign.name}
          description={campaign.draftReason ?? "Campaña manual"}
        />
      </div>

      {/* Live monitor (only when SENDING / APPROVED) */}
      <SendingMonitor campaignId={campaign.id} initialStatus={campaign.status} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT: preview + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email preview · {availableLanguages.length} idioma{availableLanguages.length > 1 ? "s" : ""}
              </CardTitle>
              <CardDescription>
                El preview reproduce exactamente lo que llega al inbox del cliente, incluyendo el footer legal de {campaign.store.legalName ?? campaign.store.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailPreviewSwitcher
                campaign={{ subject: campaign.subject, name: campaign.name, estimatedRecipients: campaign.estimatedRecipients }}
                store={{
                  defaultLanguage: campaign.store.defaultLanguage,
                  countryCode: campaign.store.countryCode,
                  legal: {
                    legalName:  campaign.store.legalName  ?? campaign.store.name,
                    vatNumber:  campaign.store.vatNumber  ?? "",
                    address:    campaign.store.legalAddress ?? "",
                    postalCode: campaign.store.legalPostalCode ?? "",
                    city:       campaign.store.legalCity ?? "",
                  },
                }}
                sender={{ fromName: campaign.sender.fromName, fromEmail: campaign.sender.fromEmail }}
                availableLanguages={availableLanguages}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
              <CardDescription>Editar copy, mandar test, aprobar o cancelar</CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignActions
                campaignId={campaign.id}
                initialSubject={campaign.subject}
                initialPreheader={campaign.preheader ?? ""}
                status={campaign.status}
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: metadata + checklist */}
        <div className="space-y-4">
          {/* Stats */}
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Row icon={<Clock className="h-3 w-3" />} label="Status"><StatusBadge status={campaign.status} /></Row>
              <Row icon={<CalendarIcon className="h-3 w-3" />} label="Scheduled">
                {campaign.scheduledFor ? <span className="text-[12px] tabular-nums">{new Date(campaign.scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span> : <span className="text-muted-foreground text-[12px]">no schedule</span>}
              </Row>
              <Row icon={<Users className="h-3 w-3" />} label="Audience">
                <span className="text-[12px] tabular-nums">{formatNumber(campaign.estimatedRecipients)}</span>
              </Row>
              <Row icon={<LanguagesIcon className="h-3 w-3" />} label="Languages">
                <div className="flex items-center gap-0.5">
                  {availableLanguages.slice(0, 6).map((code) => {
                    const lang = LANGUAGES.find((l) => l.code === code);
                    return <span key={code} title={lang?.label} className="text-sm leading-none">{lang?.flag ?? "🏳️"}</span>;
                  })}
                  {availableLanguages.length > 6 && <span className="text-[10px] text-muted-foreground">+{availableLanguages.length - 6}</span>}
                </div>
              </Row>
              <Row icon={<Mail className="h-3 w-3" />} label="From">
                <span className="text-[11px]">{campaign.sender.fromEmail}</span>
              </Row>
            </CardContent>
          </Card>

          {/* Cost */}
          <Card>
            <CardHeader><CardTitle>Coste estimado</CardTitle><CardDescription>Recalculado en cada vista</CardDescription></CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              <CostRow label="SES sending"     value={formatCurrency(cost.ses)} />
              <CostRow label="Translation"     value={formatCurrency(cost.deepl)} />
              <CostRow label="Banner generation" value={formatCurrency(cost.gemini)} />
              <div className="flex items-center justify-between border-t border-border pt-2.5 mt-1.5">
                <span className="text-[12px] font-medium">Total</span>
                <span className="text-[15px] font-medium tabular-nums">{formatCurrency(cost.total)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                ≈ {formatCurrency(cost.recipients ? cost.total / cost.recipients * 1000 : 0)} por 1k recipients
              </div>
            </CardContent>
          </Card>

          {/* Pre-flight checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {hasTranslation && hasSes ? <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" /> : <AlertCircle className="h-3.5 w-3.5 text-[color:var(--warning)]" />}
                Pre-flight
              </CardTitle>
              <CardDescription>Lo que se necesita para que Approve realmente envíe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <CheckRow ok={hasShopify}     label="Shopify token para esta tienda"  hint="Sin esto la audiencia es 0" />
              <CheckRow ok={hasTranslation} label="Engine de traducción (DeepSeek/OpenAI)" hint="Para fan-out a los 22 idiomas" />
              <CheckRow ok={hasSes}         label="AWS SES credentials + dominio verificado" hint="Sin esto los Send rows quedan en QUEUED" />
              <CheckRow ok={campaign.sender.verified} label={`Sender ${campaign.sender.fromEmail} verificado en SES`} hint="DKIM + SPF + DMARC" />
              <CheckRow ok={campaign.variants.length > 0} label={`${campaign.variants.length} variantes traducidas`} hint="Se generan al aprobar si no existen" />
            </CardContent>
          </Card>

          {/* Translation provenance */}
          {campaign.draftSource !== "MANUAL" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Origen del draft</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-[11px] text-muted-foreground space-y-1">
                <div><strong className="text-foreground">Source</strong>: {campaign.draftSource.toLowerCase().replace(/_/g, " ")}</div>
                {campaign.draftReason && <div><strong className="text-foreground">Reason</strong>: {campaign.draftReason}</div>}
                {campaign.draftLlmPrompt && (
                  <details>
                    <summary className="cursor-pointer text-[color:var(--accent)]">Ver prompt LLM</summary>
                    <pre className="mt-2 text-[10px] bg-card/40 rounded p-2 whitespace-pre-wrap font-mono">{campaign.draftLlmPrompt}</pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      {children}
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function CheckRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`grid h-4 w-4 place-items-center rounded-full shrink-0 mt-0.5 ${
        ok ? "bg-[color:var(--positive)]/15 text-[color:var(--positive)]" : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
      }`}>
        {ok ? <Check className="h-2.5 w-2.5" /> : <span className="text-[8px]">!</span>}
      </span>
      <div className="min-w-0">
        <div className={`text-[11px] ${ok ? "text-foreground" : "text-foreground font-medium"}`}>{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

// Suppress unused warning when there are no preview Image references
void Badge;
