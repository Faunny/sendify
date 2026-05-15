import Link from "next/link";
import { Inbox, Clock, Sparkles, X, Send, Languages, Calendar as CalendarIcon, Wand2, User, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { EmailPreviewCard } from "@/components/app/email-preview-card";
import { ApprovalRowActions } from "@/components/app/approval-row-actions";
import { ApprovalsBulkProvider, ApprovalRowCheckbox } from "@/components/app/approvals-bulk";
import { RegenerateDraftsButton } from "@/components/app/regenerate-drafts-button";
import { LANGUAGES } from "@/lib/languages";
import { prisma } from "@/lib/db";
import { renderMjml } from "@/lib/mjml";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Always re-fetch from DB on every visit — without this Next.js could serve a
// stale snapshot taken at build time, which made auto-planner drafts look
// "missing" right after the planner finished writing them.
export const dynamic = "force-dynamic";

const SOURCE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: "accent" | "muted" | "warning" }> = {
  AUTO_PROMOTION:   { label: "Auto-drafted · calendar",     icon: CalendarIcon, tone: "accent" },
  AUTO_FLOW_BRANCH: { label: "Auto-drafted · flow branch",  icon: Wand2,        tone: "accent" },
  AUTO_LLM:         { label: "Auto-drafted · AI",           icon: Sparkles,     tone: "accent" },
  EXTERNAL_API:     { label: "Pushed by external system",   icon: Webhook,      tone: "muted" },
  MANUAL:           { label: "Manual",                      icon: User,         tone: "muted" },
};

export default async function ApprovalsPage() {
  // Warmup query so Neon cold-start doesn't make the page hang on first paint.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [pending, statusCounts] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { scheduledFor: "asc" },
      include: {
        store: true,
        sender: { select: { fromEmail: true, fromName: true } },
        // Pull the variants' mjml so the preview card can render the actual
        // email body (not the hardcoded "Día de la Madre 11,99€" mock that
        // used to show on every campaign regardless of content).
        variants: { select: { language: true, mjml: true }, take: 30 },
      },
    }).catch(() => []),
    // Diagnostic counts so the page can show what else lives in the DB
    // (e.g. "there are 12 DRAFT campaigns waiting elsewhere"). Helps when
    // the auto-planner ran and the user wonders where the drafts went.
    prisma.campaign.groupBy({
      by: ["status"],
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
  ]);

  const countByStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all]));
  const otherTotal = Object.entries(countByStatus)
    .filter(([s]) => s !== "PENDING_APPROVAL")
    .reduce((acc, [, n]) => acc + n, 0);

  if (pending.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Approvals"
          description="Cualquier draft que cree el calendario, el builder con AI o un sistema externo aterriza aquí. Apruebas la campaña madre y todos los idiomas se liberan a la vez."
        />
        <div className="rounded-md border border-border bg-card/40 p-3 text-[12.5px] text-muted-foreground">
          El auto-planner corre solo cada 5 min en background y va creando drafts a medida que los eventos entran en su lead-window. Puedes cerrar el navegador — los drafts seguirán apareciendo aquí solos.
        </div>
        {otherTotal > 0 && (
          <div className="rounded-md border border-border bg-card/40 p-3 text-[13px]">
            <span className="font-medium">Nada PENDING_APPROVAL ahora mismo</span>{" "}
            <span className="text-muted-foreground">— pero hay {otherTotal} campañas en otros estados:</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(countByStatus).map(([status, n]) => (
                <Link key={status} href={`/campaigns?status=${status}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[12px] hover:bg-secondary/60">
                  <span className="font-mono text-foreground/80">{status}</span>
                  <span className="text-muted-foreground">×{n}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Sin nada pendiente"
          description="Cuando una promoción del calendario entre en su lead-time o cuando subas una campaña a aprobación manualmente, aparecerá aquí con el preview de cada idioma listo para revisar."
          primaryAction={{ label: "Ver calendario", href: "/calendar" }}
          secondaryAction={{ label: "Crear campaña a mano", href: "/campaigns/new" }}
        />
      </div>
    );
  }

  const autoCount = pending.filter((c) => c.draftSource.startsWith("AUTO")).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        meta={
          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Inbox className="h-3 w-3" />
              {pending.length} esperando tu revisión
            </span>
            {autoCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[color:var(--accent)]" />
                {autoCount} auto-drafted
              </span>
            )}
          </div>
        }
        title="Approvals"
        description="Apruebas la campaña madre y todos los idiomas se liberan."
        actions={autoCount > 0 ? <RegenerateDraftsButton /> : undefined}
      />

      <ApprovalsBulkProvider allIds={pending.map((c) => c.id)}>
      <div className="grid gap-3">
        {pending.map((c) => {
          const source = SOURCE_META[c.draftSource] ?? SOURCE_META.MANUAL;
          const SourceIcon = source.icon;
          const daysToSend = c.scheduledFor
            ? Math.round((new Date(c.scheduledFor).getTime() - Date.now()) / 86_400_000)
            : null;
          // Compile the source-language variant's MJML to HTML server-side so
          // the preview card renders the REAL email. Falls back to the mock
          // when no variant exists yet.
          const sourceVariant = c.variants.find((v) => v.language === c.store.defaultLanguage) ?? c.variants[0];
          let compiledHtml: string | undefined;
          if (sourceVariant?.mjml) {
            try { compiledHtml = renderMjml(sourceVariant.mjml).html; }
            catch { /* swallow — preview falls back to mockup */ }
          }
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                <ApprovalRowCheckbox id={c.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={source.tone}>
                      <SourceIcon className="h-2.5 w-2.5" /> {source.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-[15px]">{c.name}</CardTitle>
                  <CardDescription>
                    {c.store.name}
                    {c.scheduledFor && (
                      <> · scheduled for {new Date(c.scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        {daysToSend != null && <span className="text-foreground"> · {daysToSend > 0 ? `${daysToSend}d to send` : "today"}</span>}
                      </>
                    )}
                  </CardDescription>
                </div>
                </div>
                <Badge variant="warning"><Clock className="h-3 w-3" /> Pending</Badge>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {c.draftReason && (
                  <div className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-2.5 text-[12px] flex items-start gap-2">
                    <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-[color:var(--accent)]" />
                    <span className="text-foreground/90">{c.draftReason}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5">
                  {/* Visual preview — what the customer actually sees in their inbox */}
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Email preview · {LANGUAGES.find((l) => l.code === c.store.defaultLanguage)?.nativeLabel ?? c.store.defaultLanguage}
                    </div>
                    <EmailPreviewCard
                      campaign={{ subject: c.subject, name: c.name, estimatedRecipients: c.estimatedRecipients }}
                      store={{
                        defaultLanguage: c.store.defaultLanguage,
                        countryCode: c.store.countryCode,
                        legal: {
                          legalName: c.store.legalName ?? c.store.name,
                          vatNumber: c.store.vatNumber ?? "",
                          address:   c.store.legalAddress ?? "",
                          postalCode:c.store.legalPostalCode ?? "",
                          city:      c.store.legalCity ?? "",
                        },
                      }}
                      sender={c.sender ?? { fromEmail: "(sin sender)", fromName: c.store.name }}
                      language={c.store.defaultLanguage}
                      width={380}
                      html={compiledHtml}
                    />
                    <Button variant="ghost" size="sm" className="mt-2 -ml-2" asChild>
                      <Link href={`/campaigns/${c.id}`}>
                        <Languages className="h-3.5 w-3.5" /> Preview en los {c.variants.length || 1} idiomas
                      </Link>
                    </Button>
                  </div>

                  {/* Metadata column */}
                  <div className="space-y-3 min-w-0">
                    <div className="rounded-md border border-border bg-card/40 p-3 text-[14px]">
                      <span className="text-muted-foreground text-[11px] uppercase tracking-wider mr-2">Subject</span>
                      {c.subject}
                    </div>
                    {c.preheader && (
                      <div className="rounded-md border border-border bg-card/40 p-3 text-[13px]">
                        <span className="text-muted-foreground text-[11px] uppercase tracking-wider mr-2">Preheader</span>
                        {c.preheader}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Audience"       value={formatNumber(c.estimatedRecipients)} />
                      <Stat label="Languages"      value={`${c.variants.length || 1}`} />
                      <Stat label="Estimated cost" value={formatCurrency(Number(c.estimatedCost))} />
                      <Stat label="Sender"         value={c.sender?.fromEmail ?? "— sin asignar —"} small />
                    </div>

                    {c.variants.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Variantes preparadas</div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.variants.map((v) => {
                            const lang = LANGUAGES.find((l) => l.code === v.language);
                            return (
                              <span key={v.language} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[12px]">
                                <span>{lang?.flag ?? "🏳️"}</span>
                                {lang?.label ?? v.language}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <ApprovalRowActions campaignId={c.id} senderConfigured={!!c.sender} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      </ApprovalsBulkProvider>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-medium ${small ? "text-[12px]" : "text-[15px] tabular-nums"}`}>{value}</div>
    </div>
  );
}
