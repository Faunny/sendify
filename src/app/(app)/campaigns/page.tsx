import Link from "next/link";
import { Mail, Plus, Sparkles, User, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { prisma } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  AUTO_PROMOTION: CalendarIcon,
  AUTO_FLOW_BRANCH: Sparkles,
  AUTO_LLM: Sparkles,
  EXTERNAL_API: Sparkles,
  MANUAL: User,
};

export default async function CampaignsPage() {
  const [total, campaigns] = await Promise.all([
    prisma.campaign.count().catch(() => 0),
    prisma.campaign.findMany({
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        store: { select: { name: true } },
      },
    }).catch(() => []),
  ]);

  if (total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Campaigns"
          description="Drafts, scheduled and sent campaigns across all stores. Nothing leaves Sendify without your approval."
          actions={
            <Button size="sm" asChild>
              <Link href="/campaigns/new"><Plus className="h-3.5 w-3.5" /> New campaign</Link>
            </Button>
          }
        />
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title="Sin campañas todavía"
          description="Crea tu primera campaña manualmente, o deja que el auto-drafter genere una desde el calendario de promociones cuando la fecha entre en su lead-time."
          primaryAction={{ label: "Crear campaña", href: "/campaigns/new" }}
          secondaryAction={{ label: "Ver calendario", href: "/calendar" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description={`${formatNumber(total)} campañas`}
        actions={
          <Button size="sm" asChild>
            <Link href="/campaigns/new"><Plus className="h-3.5 w-3.5" /> New campaign</Link>
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">Campaign</th>
              <th className="text-left font-medium px-3 py-2.5">Store</th>
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-left font-medium px-3 py-2.5">Source</th>
              <th className="text-left font-medium px-3 py-2.5">Scheduled</th>
              <th className="text-right font-medium px-3 py-2.5">Recipients</th>
              <th className="text-right font-medium px-5 py-2.5">Cost est.</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const Icon = SOURCE_ICON[c.draftSource] ?? User;
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/campaigns/${c.id}`} className="block">
                      <div className="text-[13px] font-medium hover:text-[color:var(--accent)]">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[400px]">{c.subject}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-muted-foreground">{c.store.name.replace("divain · ", "")}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-3">
                    <Badge variant={c.draftSource === "MANUAL" ? "muted" : "accent"}>
                      <Icon className="h-2.5 w-2.5" /> {c.draftSource.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-muted-foreground tabular-nums">
                    {c.scheduledFor ? new Date(c.scheduledFor).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums">{formatNumber(c.estimatedRecipients)}</td>
                  <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(Number(c.estimatedCost))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
