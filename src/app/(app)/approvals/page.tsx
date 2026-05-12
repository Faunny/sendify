import Link from "next/link";
import { Check, Clock, Inbox, Languages, Send, Sparkles, X, Calendar, Wand2, User, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { CAMPAIGNS, PROMOTIONS, STORES } from "@/lib/mock";
import { LANGUAGES } from "@/lib/languages";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SOURCE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: "accent" | "muted" | "warning" }> = {
  AUTO_PROMOTION:   { label: "Auto-drafted · calendar",   icon: Calendar, tone: "accent" },
  AUTO_FLOW_BRANCH: { label: "Auto-drafted · flow branch",icon: Wand2,    tone: "accent" },
  AUTO_LLM:         { label: "Auto-drafted · AI",         icon: Sparkles, tone: "accent" },
  EXTERNAL_API:     { label: "Pushed by external system", icon: Webhook,  tone: "muted" },
  MANUAL:           { label: "Manual",                    icon: User,     tone: "muted" },
};

export default function ApprovalsPage() {
  const pending = CAMPAIGNS.filter((c) => c.status === "PENDING_APPROVAL");
  const autoCount = pending.filter((c) => c.draftSource?.startsWith("AUTO")).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        meta={
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Inbox className="h-3 w-3" />
              {pending.length} waiting for your review
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
        description="Anything Sendify auto-drafts from the calendar, the AI builder or an external system lands here. Approve the parent campaign and all 22 language variants ship."
      />

      {/* How it works strip */}
      <Card className="bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] border-[color:var(--accent)]/20">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" />
            How drafts get here
          </div>
          <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Step n={1} label="Promotion enters lead-time" />
            <Arrow />
            <Step n={2} label="Auto-drafter builds the email" />
            <Arrow />
            <Step n={3} label="Translations queued (22 langs)" />
            <Arrow />
            <Step n={4} label="Banner generated · Nano Banana" />
            <Arrow />
            <Step n={5} label="Lands here for your approval" />
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {pending.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Nothing waiting. Quiet day.
            </CardContent>
          </Card>
        )}
        {pending.map((c) => {
          const store = STORES.find((s) => s.id === c.storeId)!;
          const langs = LANGUAGES.slice(0, c.languages);
          const source = c.draftSource ?? "MANUAL";
          const SourceIcon = SOURCE_META[source].icon;
          const promo = c.promotionId ? PROMOTIONS.find((p) => p.id === c.promotionId) : null;
          const daysToSend = Math.round((new Date(c.scheduledFor).getTime() - Date.now()) / 86_400_000);

          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={SOURCE_META[source].tone}>
                      <SourceIcon className="h-2.5 w-2.5" />
                      {SOURCE_META[source].label}
                    </Badge>
                    {promo && <Badge variant="muted">{promo.emoji} {promo.name}</Badge>}
                  </div>
                  <CardTitle className="text-[15px]">{c.name}</CardTitle>
                  <CardDescription>
                    {store.name} · scheduled for {new Date(c.scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} <span className="text-foreground">· {daysToSend > 0 ? `${daysToSend}d to send` : "today"}</span>
                  </CardDescription>
                </div>
                <Badge variant="warning"><Clock className="h-3 w-3" /> Pending</Badge>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {c.draftReason && (
                  <div className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-2.5 text-[11px] flex items-start gap-2">
                    <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-[color:var(--accent)]" />
                    <span className="text-foreground/90">{c.draftReason}</span>
                  </div>
                )}

                <div className="rounded-md border border-border bg-card/40 p-3 text-[13px]">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider mr-2">Subject</span>
                  {c.subject}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label="Audience" value={formatNumber(c.audience)} />
                  <Stat label="Languages" value={`${c.languages}`} />
                  <Stat label="Estimated cost" value={formatCurrency(c.estimatedCost)} />
                  <Stat label="Translation cache" value="71%" hint="$128 saved this month" />
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pre-filled by the auto-drafter (you can edit any of these)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Prefilled icon={<Calendar className="h-3 w-3" />} label="Send date" value={new Date(c.scheduledFor).toLocaleDateString("en-GB", { dateStyle: "medium" })} />
                    <Prefilled icon={<Languages className="h-3 w-3" />} label="Language fan-out" value={`${c.languages} markets`} />
                    <Prefilled icon={<Sparkles className="h-3 w-3" />} label="Hero banner" value="Generated with Nano Banana · brand palette" />
                    <Prefilled icon={<Send className="h-3 w-3" />} label="Sender" value={`hola@divainparfums.com`} />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Language variants ready</div>
                  <div className="flex flex-wrap gap-1.5">
                    {langs.map((l) => (
                      <span key={l.code} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px]">
                        <span>{l.flag}</span>
                        {l.label}
                        <Check className="h-2.5 w-2.5 text-[color:var(--positive)]" />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/campaigns/${c.id}`}><Languages className="h-3.5 w-3.5" /> Preview all languages</Link>
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm"><X className="h-3.5 w-3.5" /> Reject</Button>
                    <Button variant="outline" size="sm">Edit before approving</Button>
                    <Button size="sm"><Send className="h-3.5 w-3.5" /> Approve & schedule</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[color:var(--accent)] text-[color:var(--accent-fg)] text-[8px] font-medium">{n}</span>
      {label}
    </span>
  );
}
function Arrow() {
  return <span className="text-muted-foreground/60">→</span>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[15px] font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-[color:var(--positive)] mt-0.5">{hint}</div>}
    </div>
  );
}

function Prefilled({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5 flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[12px] truncate">{value}</div>
      </div>
    </div>
  );
}
