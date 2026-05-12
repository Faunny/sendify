import { AlertCircle, Ban, Download, Plus, Search, ShieldOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { SUPPRESSIONS } from "@/lib/mock";

const REASON_META: Record<string, { label: string; tone: "danger" | "warning" | "muted" }> = {
  BOUNCE_HARD:  { label: "Hard bounce",   tone: "danger" },
  COMPLAINT:    { label: "Spam complaint",tone: "danger" },
  UNSUBSCRIBE:  { label: "Unsubscribed",  tone: "muted" },
  MANUAL:       { label: "Manual",        tone: "warning" },
};

export default function SuppressionsPage() {
  const byReason = SUPPRESSIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s.reason] = (acc[s.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        meta={<div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldOff className="h-3 w-3" /> Cross-store: an entry here blocks every sender</div>}
        title="Suppression list"
        description="Emails Sendify will never deliver to. Driven by SES bounce/complaint webhooks, customer unsubscribes and manual additions."
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5" /> Import</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add manually</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Ban} label="Total suppressed" value={`${SUPPRESSIONS.length}`} hint="all reasons" />
        <Stat icon={AlertCircle} label="Hard bounces" value={`${byReason.BOUNCE_HARD ?? 0}`} hint="invalid mailboxes" tone="danger" />
        <Stat icon={ShieldOff} label="Complaints" value={`${byReason.COMPLAINT ?? 0}`} hint="kills deliverability if >0.1%" tone="danger" />
        <Stat icon={ShieldOff} label="Unsubscribes" value={`${byReason.UNSUBSCRIBE ?? 0}`} hint="customer choice" />
      </div>

      <Card className="bg-[color-mix(in_oklch,var(--warning)_5%,transparent)] border-[color:var(--warning)]/30">
        <CardContent className="p-3 flex items-start gap-2 text-[11px]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[color:var(--warning)]" />
          <div>
            <span className="font-medium text-foreground">Be careful when removing suppressions.</span>{" "}
            <span className="text-muted-foreground">Re-sending to a hard-bounced address triggers SES rate-limiting that affects all your senders. Only remove if the customer asked AND you can verify the address is valid.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search email…" className="pl-8" />
        </div>
        <Button variant="ghost" size="sm">All reasons</Button>
        <Button variant="ghost" size="sm">Last 30 days</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">Email</th>
              <th className="text-left font-medium px-3 py-2.5">Reason</th>
              <th className="text-left font-medium px-3 py-2.5">Source</th>
              <th className="text-left font-medium px-3 py-2.5">Added</th>
              <th className="text-right font-medium px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SUPPRESSIONS.map((s) => {
              const m = REASON_META[s.reason];
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-2.5 text-[12px] font-mono">{s.email}</td>
                  <td className="px-3 py-2.5"><Badge variant={m.tone}>{m.label}</Badge></td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground">{s.source}</td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(s.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="text-[color:var(--danger)] h-7 px-2">
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone?: "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-[22px] font-medium tabular-nums ${tone === "danger" ? "text-[color:var(--danger)]" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </Card>
  );
}
