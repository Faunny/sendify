import { ArrowDownRight, ArrowUpRight, Calendar, Clock, ExternalLink, Mail, Sparkles, TrendingUp, AlertTriangle, Globe, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SendsAreaChart } from "@/components/charts/area-chart";
import { CostDonut } from "@/components/charts/donut-chart";
import { LangBars } from "@/components/charts/bar-chart";
import { CAMPAIGNS, SENDERS, STORES, makeCostBreakdown, makeLanguageShare, makeSendTrend } from "@/lib/mock";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { estimateMonthlyInfra } from "@/lib/cost";
import Link from "next/link";

export default function DashboardPage() {
  const trend = makeSendTrend();
  const costs = makeCostBreakdown();
  const langs = makeLanguageShare();
  const monthSent = trend.reduce((s, d) => s + d.sent, 0);
  const monthOpened = trend.reduce((s, d) => s + d.opened, 0);
  const monthRevenue = trend.reduce((s, d) => s + d.revenue, 0);
  const upcoming = CAMPAIGNS.filter((c) => ["APPROVED", "SCHEDULED", "PENDING_APPROVAL"].includes(c.status));
  const infra = estimateMonthlyInfra(20_000_000);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        meta={
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--positive)]" />
            All systems healthy · SES eu-west-1
          </div>
        }
        title="Good morning, Faun"
        description="Here's how Divain's emails are performing this month across the 4 stores."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Calendar className="h-3.5 w-3.5" />
              May 2026
            </Button>
            <Button size="sm" asChild>
              <Link href="/campaigns/new">
                <Sparkles className="h-3.5 w-3.5" />
                New campaign
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Emails sent · MTD"
          value={formatNumber(monthSent)}
          delta="+12.4%"
          deltaTone="up"
          hint={`of ~20M/mo target · ${((monthSent / 20_000_000) * 100).toFixed(0)}%`}
          progress={(monthSent / 20_000_000) * 100}
        />
        <KpiCard
          label="Open rate"
          value={`${((monthOpened / monthSent) * 100).toFixed(1)}%`}
          delta="+1.8 pts"
          deltaTone="up"
          hint="industry benchmark: 21%"
        />
        <KpiCard
          label="Attributed revenue"
          value={formatCurrency(monthRevenue)}
          delta="+18.2%"
          deltaTone="up"
          hint="last-touch, 7-day window"
        />
        <KpiCard
          label="Spend · MTD"
          value={formatCurrency(costs.reduce((s, c) => s + c.value, 0))}
          delta="-6.1%"
          deltaTone="down-good"
          hint={`forecast EOM: ${formatCurrency(infra.total)}`}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Sends · last 30 days
              </CardTitle>
              <CardDescription>Sent vs opened, all stores combined</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <Legend swatch="var(--chart-1)" label="Sent" />
              <Legend swatch="var(--chart-3)" label="Opened" />
            </div>
          </CardHeader>
          <CardContent>
            <SendsAreaChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /> Spend breakdown
            </CardTitle>
            <CardDescription>Provider mix · MTD</CardDescription>
          </CardHeader>
          <CardContent>
            <CostDonut data={costs} />
            <ul className="mt-4 space-y-1.5">
              {costs.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-sm" style={{ background: ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"][i] }} />
                    {c.name}
                  </span>
                  <span className="tabular-nums">${c.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Upcoming sends
              </CardTitle>
              <CardDescription>Next 14 days · all stores</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/campaigns">View all <ExternalLink className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {upcoming.map((c) => {
                const store = STORES.find((s) => s.id === c.storeId);
                return (
                  <li key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-[10px] font-medium">
                      {store?.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {store?.name} · {new Date(c.scheduledFor).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {c.languages} lang{c.languages > 1 ? "s" : ""} · {formatNumber(c.audience)} recipients
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] tabular-nums">{formatCurrency(c.estimatedCost)}</div>
                      <div className="text-[10px] text-muted-foreground">est.</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Top languages
            </CardTitle>
            <CardDescription>Sends share · MTD</CardDescription>
          </CardHeader>
          <CardContent>
            <LangBars data={langs} />
          </CardContent>
        </Card>
      </div>

      {/* Third row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" /> Sender reputation
            </CardTitle>
            <CardDescription>SES configuration sets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SENDERS.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.fromEmail}</span>
                    {!s.verified && <Badge variant="danger">unverified</Badge>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{s.verified ? `${(s.reputation * 100).toFixed(0)}%` : "—"}</span>
                </div>
                <Progress value={s.verified ? s.reputation * 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--warning)]" /> Attention
            </CardTitle>
            <CardDescription>2 things to look at</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Attention
              tone="warning"
              title="Sender tx@mail.divaincare.com unverified"
              body="DKIM and SPF records not yet detected. Run the DNS check from Settings → Senders."
              href="/settings/senders"
            />
            <Attention
              tone="warning"
              title="2 campaigns awaiting approval"
              body="Día de la Madre (ES) and Fête des Mères (FR/BE/CH) will miss their slot if not approved today."
              href="/approvals"
            />
            <Attention
              tone="positive"
              title="Translation cache hit rate: 71%"
              body="Up from 48% last month. Saves an estimated $128 in DeepL spend this month."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Store performance</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {STORES.map((s) => {
                const ratio = s.subscribed / s.customers;
                return (
                  <li key={s.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground tabular-nums">{formatNumber(s.subscribed)} / {formatNumber(s.customers)}</span>
                    </div>
                    <Progress value={ratio * 100} />
                    <div className="text-[10px] text-muted-foreground">{(ratio * 100).toFixed(1)}% subscribed</div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  hint,
  progress,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "down-good";
  hint?: string;
  progress?: number;
}) {
  const up = deltaTone === "up" || deltaTone === "down-good";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
          {delta && (
            <span className={`flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-[color:var(--positive)]" : "text-[color:var(--danger)]"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </span>
          )}
        </div>
        <div className="mt-2 text-[28px] font-medium tracking-tight tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        {typeof progress === "number" && (
          <div className="mt-3">
            <Progress value={Math.min(100, progress)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}

function Attention({
  tone,
  title,
  body,
  href,
}: {
  tone: "warning" | "positive" | "danger";
  title: string;
  body: string;
  href?: string;
}) {
  const color = tone === "warning" ? "var(--warning)" : tone === "positive" ? "var(--positive)" : "var(--danger)";
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium">{title}</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{body}</p>
          {href && (
            <Link href={href} className="mt-1 inline-flex items-center gap-1 text-[11px] text-[color:var(--accent)] hover:underline">
              Take a look <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
