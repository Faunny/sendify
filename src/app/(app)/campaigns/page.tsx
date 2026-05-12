import Link from "next/link";
import { Filter, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { CAMPAIGNS, STORES } from "@/lib/mock";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default function CampaignsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description="Drafts, scheduled and sent campaigns across all stores. Send only after approval; translation runs automatically per recipient language."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </Button>
            <Button size="sm" asChild>
              <Link href="/campaigns/new">
                <Plus className="h-3.5 w-3.5" />
                New campaign
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, subject…" className="pl-8" />
        </div>
        <Button variant="ghost" size="sm">All stores</Button>
        <Button variant="ghost" size="sm">All statuses</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Campaign</th>
                <th className="text-left font-medium px-3 py-2.5">Store</th>
                <th className="text-left font-medium px-3 py-2.5">Status</th>
                <th className="text-left font-medium px-3 py-2.5">Schedule</th>
                <th className="text-right font-medium px-3 py-2.5">Audience</th>
                <th className="text-right font-medium px-3 py-2.5">Languages</th>
                <th className="text-right font-medium px-3 py-2.5">Open</th>
                <th className="text-right font-medium px-3 py-2.5">CTR</th>
                <th className="text-right font-medium px-3 py-2.5">Revenue</th>
                <th className="text-right font-medium px-5 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGNS.map((c) => {
                const store = STORES.find((s) => s.id === c.storeId);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/campaigns/${c.id}`} className="block">
                        <div className="font-medium text-[13px]">{c.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{c.subject}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">{store?.name}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground tabular-nums">
                      {new Date(c.scheduledFor).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums">{formatNumber(c.audience)}</td>
                    <td className="px-3 py-3 text-right">
                      <Badge variant="muted">{c.languages}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums">{c.openRate ? `${(c.openRate * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums">{c.ctr ? `${(c.ctr * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums">{c.revenue ? formatCurrency(c.revenue) : "—"}</td>
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(c.estimatedCost)}</td>
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
