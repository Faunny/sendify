import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Ban, Calendar, Check, Clock, ExternalLink, Globe, Mail, MailCheck, MailOpen, MessageSquare,
  MoreHorizontal, MousePointerClick, Package, Pencil, Send, ShoppingBag, Smartphone, Sparkles, Tag, X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { CAMPAIGNS, makeCustomers, SEGMENTS, STORES } from "@/lib/mock";
import { languageByCode } from "@/lib/languages";
import { cn, formatCurrency, initials } from "@/lib/utils";

// Deterministic timeline generator keyed on customer id so the page is stable across reloads.
function generateTimeline(customerId: string, storeCurrency: string) {
  let seed = customerId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const now = Date.now();
  type Ev =
    | { kind: "send";       at: number; campaign: string; status: "delivered" | "opened" | "clicked" }
    | { kind: "order";      at: number; amount: number; items: number; orderId: string }
    | { kind: "cart";       at: number; amount: number; recovered: boolean }
    | { kind: "browse";     at: number; product: string }
    | { kind: "push";       at: number; campaign: string }
    | { kind: "unsub";      at: number; channel: "email" | "push" }
    | { kind: "app";        at: number; event: "installed" | "opened" }
    | { kind: "segment";    at: number; segment: string; action: "joined" | "left" }
    | { kind: "support";    at: number; subject: string };

  const events: Ev[] = [];
  for (let i = 0; i < 22; i++) {
    const r = rand();
    const at = now - i * 86_400_000 * (1 + rand() * 2);
    if (r < 0.35) events.push({ kind: "send", at, campaign: ["Día de la Madre — ES", "Win-back 90d", "Restock favorites", "VIP early access", "Spring Drop"][Math.floor(rand() * 5)], status: r < 0.12 ? "clicked" : r < 0.25 ? "opened" : "delivered" });
    else if (r < 0.5) events.push({ kind: "order", at, amount: Math.round(14 + rand() * 80), items: 1 + Math.floor(rand() * 3), orderId: `#${(1000 + Math.floor(rand() * 9000)).toString()}` });
    else if (r < 0.62) events.push({ kind: "cart", at, amount: Math.round(20 + rand() * 60), recovered: r < 0.55 });
    else if (r < 0.74) events.push({ kind: "browse", at, product: ["DIVAIN-103", "DIVAIN-215", "DIVAIN-073", "DIVAIN-540", "DIVAIN-008"][Math.floor(rand() * 5)] });
    else if (r < 0.82) events.push({ kind: "push", at, campaign: ["Día de la Madre", "Black Friday teaser", "Restock alert"][Math.floor(rand() * 3)] });
    else if (r < 0.88) events.push({ kind: "app", at, event: i === 18 ? "installed" : "opened" });
    else if (r < 0.94) events.push({ kind: "segment", at, segment: SEGMENTS[Math.floor(rand() * SEGMENTS.length)].name, action: rand() > 0.4 ? "joined" : "left" });
    else if (r < 0.98) events.push({ kind: "support", at, subject: "Pregunta sobre envío" });
    else events.push({ kind: "unsub", at, channel: rand() > 0.5 ? "email" : "push" });
  }

  void storeCurrency;
  return events.sort((a, b) => b.at - a.at);
}

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  send: Mail, order: ShoppingBag, cart: Package, browse: Globe, push: Smartphone, unsub: X, app: Smartphone, segment: Tag, support: MessageSquare,
};

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = makeCustomers(100);
  const c = all.find((x) => x.id === id);
  if (!c) return notFound();
  const store = STORES.find((s) => s.id === c.storeId)!;
  const lang = languageByCode(c.language);
  const timeline = generateTimeline(c.id, store.currency);
  const stats = {
    totalSent: timeline.filter((e) => e.kind === "send").length,
    totalOpened: timeline.filter((e) => e.kind === "send" && (e.status === "opened" || e.status === "clicked")).length,
    totalClicked: timeline.filter((e) => e.kind === "send" && e.status === "clicked").length,
    abandonedActive: timeline.find((e) => e.kind === "cart" && !e.recovered) ? 1 : 0,
  };
  const recentCampaigns = CAMPAIGNS.filter((cp) => cp.storeId === c.storeId).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
        <Link href="/customers"><ArrowLeft className="h-3.5 w-3.5" /> Customers</Link>
      </Button>

      {/* Hero card */}
      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold-700)] text-[20px] font-medium text-[var(--accent-fg)]">
            {initials(`${c.firstName} ${c.lastName}`)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-medium tracking-tight">{c.firstName} {c.lastName}</h1>
              <Badge variant={c.consentStatus === "SUBSCRIBED" ? "positive" : c.consentStatus === "BOUNCED" ? "danger" : "muted"}>{c.consentStatus.toLowerCase()}</Badge>
              {c.hasApp && <Badge variant="accent" className="gap-1"><Smartphone className="h-2.5 w-2.5" /> Has app</Badge>}
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{c.email}</span>
              <span>·</span>
              <span>{lang?.flag} {lang?.label}</span>
              <span>·</span>
              <span>{c.country}</span>
              <span>·</span>
              <span>{store.name}</span>
              <span>·</span>
              <span className="font-mono text-[11px]">shopify:{c.id.replace("cu_", "")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Send className="h-3.5 w-3.5" /> Send test</Button>
            <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Lifetime value" value={formatCurrency(c.totalSpent, store.currency)} hint={`${c.ordersCount} orders`} big />
        <Stat label="Last seen" value={`${Math.round((Date.now() - new Date(c.lastSeen).getTime()) / 86_400_000)}d ago`} hint={new Date(c.lastSeen).toLocaleDateString("en-GB")} />
        <Stat label="Emails sent" value={`${stats.totalSent}`} hint="last 90 days" />
        <Stat label="Opens" value={`${stats.totalOpened}`} hint={stats.totalSent ? `${Math.round(stats.totalOpened / stats.totalSent * 100)}% rate` : "—"} />
        <Stat label="Clicks" value={`${stats.totalClicked}`} hint={stats.totalSent ? `${Math.round(stats.totalClicked / stats.totalSent * 100)}% rate` : "—"} />
        <Stat label="Open cart" value={stats.abandonedActive ? "Yes" : "No"} hint={stats.abandonedActive ? "auto-recovery active" : ""} tone={stats.abandonedActive ? "warning" : undefined} />
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="sends">Sends</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* ── Timeline ── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Activity</CardTitle>
              <CardDescription>All channels combined · last 60 days</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-border">
                {timeline.map((e, idx) => {
                  const Icon = EVENT_ICON[e.kind] ?? Sparkles;
                  return (
                    <li key={idx} className="relative">
                      <span className={cn(
                        "absolute -left-[18px] top-1 grid h-5 w-5 place-items-center rounded-full border",
                        e.kind === "order" ? "bg-[color-mix(in_oklch,var(--positive)_15%,transparent)] border-[color:var(--positive)]/40" :
                        e.kind === "unsub" ? "bg-[color-mix(in_oklch,var(--danger)_15%,transparent)] border-[color:var(--danger)]/40" :
                        e.kind === "cart" && (e as { recovered: boolean }).recovered === false ? "bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] border-[color:var(--warning)]/40" :
                        "bg-card border-border"
                      )}>
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <div className="rounded-md border border-border bg-card/40 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <TimelineLine event={e} currency={store.currency} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {new Date(e.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Orders ── */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium px-5 py-2.5">Order</th>
                  <th className="text-left font-medium px-3 py-2.5">Date</th>
                  <th className="text-right font-medium px-3 py-2.5">Items</th>
                  <th className="text-right font-medium px-5 py-2.5">Total</th>
                </tr></thead>
                <tbody>
                  {timeline.filter((e): e is Extract<ReturnType<typeof generateTimeline>[number], { kind: "order" }> => e.kind === "order").map((o, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-2.5 font-mono text-[12px]">{o.orderId}</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{new Date(o.at).toLocaleDateString("en-GB")}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]">{o.items}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums font-medium">{formatCurrency(o.amount, store.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sends ── */}
        <TabsContent value="sends">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium px-5 py-2.5">Campaign</th>
                  <th className="text-left font-medium px-3 py-2.5">Sent</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                </tr></thead>
                <tbody>
                  {recentCampaigns.map((cp) => (
                    <tr key={cp.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-2.5">
                        <div className="text-[13px] font-medium">{cp.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[300px]">{cp.subject}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{new Date(cp.scheduledFor).toLocaleDateString("en-GB")}</td>
                      <td className="px-3 py-2.5">
                        {cp.openRate ? <Badge variant="positive"><MailOpen className="h-2.5 w-2.5" /> Opened</Badge> : <Badge variant="muted"><MailCheck className="h-2.5 w-2.5" /> Delivered</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Segments ── */}
        <TabsContent value="segments">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SEGMENTS.filter((s) => s.storeId === c.storeId).slice(0, 3).map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="text-[13px] font-medium">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{s.description}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="positive"><Check className="h-2.5 w-2.5" /> Member</Badge>
                    <span className="text-[11px] text-muted-foreground">since 12 Mar</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Preferences ── */}
        <TabsContent value="preferences">
          <Card>
            <CardContent className="p-5 space-y-3">
              <Pref label="Marketing email" on />
              <Pref label="Push notifications" on={c.hasApp} />
              <Pref label="SMS" on={false} />
              <Pref label="Promotional content" on />
              <Pref label="Restock alerts" on />
              <Pref label="Birthday surprises" on />
              <div className="border-t border-border pt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">GDPR controls</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3" /> Export data</Button>
                  <Button variant="outline" size="sm" className="text-[color:var(--danger)]"><Ban className="h-3 w-3" /> Right to erasure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, hint, big, tone }: { label: string; value: string; hint?: string; big?: boolean; tone?: "warning" }) {
  return (
    <Card className={cn("p-3", big && "lg:col-span-1")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-medium tabular-nums", big ? "text-[20px]" : "text-[15px]", tone === "warning" && "text-[color:var(--warning)]")}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function TimelineLine({ event, currency }: { event: ReturnType<typeof generateTimeline>[number]; currency: string }) {
  switch (event.kind) {
    case "send":
      return <>
        <span className="text-[12px]"><strong>Email {event.status}</strong> · {event.campaign}</span>
        {event.status === "clicked" && <Badge variant="accent" className="ml-2"><MousePointerClick className="h-2.5 w-2.5" /> clicked</Badge>}
      </>;
    case "order":
      return <span className="text-[12px]"><strong>Order placed</strong> · {event.items} item{event.items > 1 ? "s" : ""} · <span className="font-mono tabular-nums">{formatCurrency(event.amount, currency)}</span> · {event.orderId}</span>;
    case "cart":
      return <span className="text-[12px]"><strong>{event.recovered ? "Cart recovered" : "Cart abandoned"}</strong> · {formatCurrency(event.amount, currency)}</span>;
    case "browse":
      return <span className="text-[12px]"><strong>Browsed</strong> · {event.product}</span>;
    case "push":
      return <span className="text-[12px]"><strong>Push delivered</strong> · {event.campaign}<span className="ml-2 text-muted-foreground text-[10px]">→ email suppressed for 24h</span></span>;
    case "app":
      return <span className="text-[12px]"><strong>App {event.event}</strong></span>;
    case "segment":
      return <span className="text-[12px]"><strong>Segment {event.action}</strong> · {event.segment}</span>;
    case "support":
      return <span className="text-[12px]"><strong>Support ticket</strong> · {event.subject}</span>;
    case "unsub":
      return <span className="text-[12px]"><strong>Unsubscribed</strong> from {event.channel}</span>;
  }
}

function Pref({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span>{label}</span>
      {on ? <Badge variant="positive"><Check className="h-2.5 w-2.5" /> Subscribed</Badge> : <Badge variant="muted">Off</Badge>}
    </div>
  );
}

void Calendar;
