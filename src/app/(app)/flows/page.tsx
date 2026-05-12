import { Workflow, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/page-header";
import { FLOWS, STORES } from "@/lib/mock";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

const TRIGGER_LABEL: Record<string, string> = {
  WELCOME: "Welcome series",
  ABANDONED_CART: "Abandoned cart",
  POST_PURCHASE: "Post-purchase",
  WIN_BACK: "Win-back",
  BROWSE_ABANDONMENT: "Browse abandonment",
  RESTOCK: "Restock",
  BIRTHDAY: "Birthday",
  CUSTOM: "Custom",
};

export default function FlowsPage() {
  const active = FLOWS.filter((f) => f.active);
  const draft = FLOWS.filter((f) => !f.active);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Flows"
        description="Automations triggered by Shopify events. Each flow is multilingual end-to-end and runs through the same approval gate as campaigns when a new branch is added."
        actions={<Button size="sm"><Plus className="h-3.5 w-3.5" /> New flow</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[...active, ...draft].map((f) => {
          const store = STORES.find((s) => s.id === f.storeId)!;
          return (
            <Card key={f.id} className="hover:border-border/80 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                      {f.name}
                    </CardTitle>
                    <CardDescription>{store.name} · {TRIGGER_LABEL[f.trigger]}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.active ? <Badge variant="positive">Live</Badge> : <Badge variant="muted">Draft</Badge>}
                    <Switch defaultChecked={f.active} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Enrolled" value={formatNumber(f.enrolled)} />
                  <Metric label="Conversion" value={f.conversionRate ? formatPercent(f.conversionRate) : "—"} />
                  <Metric label="Revenue 30d" value={f.revenue30d ? formatCurrency(f.revenue30d) : "—"} />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground overflow-x-auto">
                  <FlowNode label="Trigger" />
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <FlowNode label="Wait 1h" />
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <FlowNode label="Send" tone="accent" />
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <FlowNode label="Wait 24h" />
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <FlowNode label="If opened" />
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <FlowNode label="Send" tone="accent" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

function FlowNode({ label, tone }: { label: string; tone?: "accent" }) {
  return (
    <span className={`shrink-0 rounded border border-border px-2 py-0.5 text-[10px] ${tone === "accent" ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-[color:var(--accent)] border-[color:var(--accent)]/30" : "bg-card/60"}`}>
      {label}
    </span>
  );
}
