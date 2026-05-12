import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { SendsAreaChart } from "@/components/charts/area-chart";
import { LangBars } from "@/components/charts/bar-chart";
import { CAMPAIGNS, STORES, makeSendTrend, makeLanguageShare } from "@/lib/mock";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default function ReportsPage() {
  const trend = makeSendTrend();
  const langs = makeLanguageShare();
  const sent = CAMPAIGNS.filter((c) => c.status === "SENT");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Performance, deliverability and revenue attribution across all stores and languages."
        actions={
          <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Delivered" value="98.2%" delta="+0.4pt" up />
        <Kpi label="Open rate" value="36.4%" delta="+1.8pt" up />
        <Kpi label="CTR" value="7.1%" delta="+0.6pt" up />
        <Kpi label="Bounce rate" value="0.9%" delta="-0.2pt" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sends · last 30 days</CardTitle>
            <CardDescription>Sent vs opened</CardDescription>
          </CardHeader>
          <CardContent><SendsAreaChart data={trend} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>Share of total sends</CardDescription>
          </CardHeader>
          <CardContent><LangBars data={langs} /></CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <div className="text-[14px] font-medium">Recent campaigns · performance</div>
          <div className="text-[11px] text-muted-foreground">Open, CTR and attributed revenue</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Campaign</th>
                <th className="text-left font-medium px-3 py-2.5">Store</th>
                <th className="text-right font-medium px-3 py-2.5">Sent</th>
                <th className="text-right font-medium px-3 py-2.5">Delivered</th>
                <th className="text-right font-medium px-3 py-2.5">Open</th>
                <th className="text-right font-medium px-3 py-2.5">CTR</th>
                <th className="text-right font-medium px-3 py-2.5">Revenue</th>
                <th className="text-right font-medium px-5 py-2.5">$ / 1k</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((c) => {
                const store = STORES.find((s) => s.id === c.storeId)!;
                const perK = (c.revenue ?? 0) / (c.audience / 1000);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-5 py-2.5">
                      <div className="text-[13px] font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.subject}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{store.name.replace("Divain ", "")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">{formatNumber(c.audience)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">98.2%</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">{c.openRate ? formatPercent(c.openRate) : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">{c.ctr ? formatPercent(c.ctr) : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(c.revenue ?? 0)}</td>
                    <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">
                      <Badge variant="positive">{formatCurrency(perK)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, delta, up }: { label: string; value: string; delta: string; up: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[22px] font-medium tabular-nums">{value}</span>
        <span className={`flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-[color:var(--positive)]" : "text-[color:var(--danger)]"}`}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta}
        </span>
      </div>
    </Card>
  );
}
