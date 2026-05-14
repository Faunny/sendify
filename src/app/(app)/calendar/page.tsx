import Link from "next/link";
import { Calendar as CalendarIcon, Sparkles, Clock, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { AutoPlanButton } from "@/components/app/auto-plan-button";
import { TestSendPromo } from "@/components/app/test-send-promo";
import { prisma } from "@/lib/db";
import { MARKETING_CALENDAR_2026, dateForStore, type CalendarEvent } from "@/lib/calendar/marketing-events";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const stores = await prisma.store.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);

  // Load active Promotion rows for the "test-send" picker. Sort by closest-
  // upcoming-date so the dropdown shows the most relevant first.
  const todayMs = Date.now();
  const promoRows = await prisma.promotion.findMany({
    where: { active: true },
    select: { id: true, name: true, storeId: true, dateByCountry: true },
    take: 250,
  }).catch(() => []);
  const promosForPicker = promoRows.map((p) => {
    const dates = (p.dateByCountry ?? {}) as Record<string, unknown>;
    let nearest = Number.POSITIVE_INFINITY;
    let nearestDate: string | null = null;
    for (const range of Object.values(dates)) {
      const endStr = typeof range === "string"
        ? range
        : (range && typeof range === "object" && "end" in range ? (range as { end?: string }).end : null) ?? null;
      if (!endStr) continue;
      const t = new Date(endStr).getTime();
      if (isNaN(t)) continue;
      const diff = Math.abs(t - todayMs);
      if (diff < nearest) { nearest = diff; nearestDate = endStr; }
    }
    const store = stores.find((s) => s.id === p.storeId);
    return {
      id: p.id, name: p.name,
      storeSlug: store?.slug ?? null,
      storeName: store?.name ?? null,
      nextDate: nearestDate,
      _sortKey: nearest,
    };
  }).sort((a, b) => a._sortKey - b._sortKey).slice(0, 50);

  // Fetch every campaign that has a draftReason — that's how the auto-planner
  // tags its work — so we can show "drafted ✓" badges next to events.
  const drafts = await prisma.campaign.findMany({
    where: { draftSource: "AUTO_PROMOTION", status: { in: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "SENDING", "SENT"] } },
    select: { id: true, storeId: true, status: true, scheduledFor: true, draftReason: true, subject: true },
    orderBy: { scheduledFor: "asc" },
    take: 500,
  }).catch(() => []);

  const draftsByKey = new Map<string, typeof drafts[number]>();
  for (const d of drafts) {
    // draftReason format: "{slug} · {N}d before YYYY-MM-DD"
    const eventSlug = d.draftReason?.split(" · ")[0] ?? "";
    draftsByKey.set(`${d.storeId}::${eventSlug}`, d);
  }

  // Pull the active webhook-pushed promotions and merge with the seeded
  // calendar so the grid below shows EVERY upcoming event — both the
  // hard-coded ones (Mother's Day, Black Friday, etc) and whatever the
  // upstream marketing system pushed via /api/promotions/webhook. Without
  // this merge the calendar grid was iterating only MARKETING_CALENDAR_2026
  // and ~50 pushed events were invisible despite being in the DB and
  // already auto-drafted into /approvals.
  const pushedPromotions = await prisma.promotion.findMany({
    where: { active: true },
    select: { externalId: true, name: true, kind: true, dateByCountry: true, leadDays: true, briefForLlm: true },
    take: 500,
  }).catch(() => []);
  const pushedEvents: CalendarEvent[] = pushedPromotions.map((p) => ({
    slug: p.externalId ?? `promo-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`,
    name: p.name,
    kind: p.kind === "STORE" ? "BRAND_OWN" : p.kind,
    pillar: "ALL",
    dateByCountry: (p.dateByCountry ?? {}) as Record<string, string>,
    brief: p.briefForLlm ?? p.name,
    tone: "editorial-cálido",
    leadDays: p.leadDays,
  }));
  const eventsBySlug = new Map<string, CalendarEvent>();
  for (const e of [...pushedEvents, ...MARKETING_CALENDAR_2026]) eventsBySlug.set(e.slug, e);
  const allEvents = [...eventsBySlug.values()];

  // Build the per-store, per-event grid sorted by send date.
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 86_400_000);
  const rows: Array<{
    storeId: string;
    storeSlug: string;
    storeName: string;
    eventSlug: string;
    eventName: string;
    pillar: string;
    sendDate: Date;
    leadDays: number;
    draftWindowStart: Date;
    inLeadWindow: boolean;
    draft?: typeof drafts[number];
  }> = [];

  for (const store of stores) {
    for (const event of allEvents) {
      const dateIso = dateForStore(event, store.slug);
      if (!dateIso) continue;
      const sendDate = new Date(dateIso);
      if (sendDate < now || sendDate > horizon) continue;
      const draftWindowStart = new Date(sendDate.getTime() - event.leadDays * 86_400_000);
      const inLeadWindow = now >= draftWindowStart && now <= sendDate;
      rows.push({
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        eventSlug: event.slug,
        eventName: event.name,
        pillar: event.pillar,
        sendDate,
        leadDays: event.leadDays,
        draftWindowStart,
        inLeadWindow,
        draft: draftsByKey.get(`${store.id}::${event.slug}`),
      });
    }
  }
  rows.sort((a, b) => a.sendDate.getTime() - b.sendDate.getTime());

  // Summary counters
  const ready    = rows.filter((r) => !r.draft && r.inLeadWindow).length;
  const drafted  = rows.filter((r) => r.draft && r.draft.status === "DRAFT").length;
  const pending  = rows.filter((r) => r.draft && r.draft.status === "PENDING_APPROVAL").length;
  const sched    = rows.filter((r) => r.draft && (r.draft.status === "SCHEDULED" || r.draft.status === "SENDING")).length;
  const sent     = rows.filter((r) => r.draft && r.draft.status === "SENT").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calendario de promociones"
        description="Sendify drafta automáticamente cada email N días antes del envío. Tú solo apruebas. El cron diario a las 06:00 UTC vigila los próximos 30 días por tienda."
        actions={
          <AutoPlanButton />
        }
      />

      <TestSendPromo promos={promosForPicker} defaultEmail="divain@divainparfums.com" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Mini label="Lista para draftear" value={ready}     accent="accent" />
        <Mini label="Draft IA"             value={drafted}  accent="muted" />
        <Mini label="Pendiente aprobación" value={pending}  accent="accent" />
        <Mini label="Programado"           value={sched}    accent="positive" />
        <Mini label="Enviado"              value={sent}     accent="positive" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-[14px] font-medium">No hay promociones en los próximos 90 días</div>
            <div className="text-[13px] text-muted-foreground mt-1">El calendario seed cubre 2026 — añade más eventos vía /api/promotions/webhook o edita src/lib/calendar/marketing-events.ts</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const daysUntil = Math.ceil((r.sendDate.getTime() - now.getTime()) / 86_400_000);
            const statusBadge =
              r.draft?.status === "SENT" ? <Badge variant="positive">Enviado</Badge>
              : r.draft?.status === "SCHEDULED" ? <Badge variant="positive">Programado</Badge>
              : r.draft?.status === "SENDING" ? <Badge variant="positive">Enviando</Badge>
              : r.draft?.status === "PENDING_APPROVAL" ? <Badge variant="warning">Pendiente aprobación</Badge>
              : r.draft ? <Badge variant="muted">Draft</Badge>
              : r.inLeadWindow ? <Badge variant="warning">Listo para draftear</Badge>
              : <Badge variant="muted">{daysUntil}d antes</Badge>;

            return (
              <Card key={`${r.storeId}::${r.eventSlug}`} className="hover:border-[color:var(--accent)]/40 transition-colors">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-[13px] font-mono">
                    {r.sendDate.toISOString().slice(5, 10)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[14px] font-medium truncate">{r.eventName}</div>
                      <Badge variant="muted" className="text-[11px]">{r.pillar}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[12px] text-muted-foreground">
                      <span className="truncate">{r.storeName}</span>
                      <span>·</span>
                      <span>lead {r.leadDays}d</span>
                      {r.draft && (
                        <>
                          <span>·</span>
                          <span className="truncate italic">{r.draft.subject}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge}
                    {r.draft && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/campaigns/${r.draft.id}`} className="text-[12px]">Ver →</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: number; accent: "accent" | "muted" | "positive" }) {
  const color =
    accent === "accent"   ? "text-[color:var(--accent)]"
    : accent === "positive" ? "text-[color:var(--positive)]"
    : "text-muted-foreground";
  return (
    <Card className="bg-card/40">
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-[20px] font-medium tabular-nums mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
