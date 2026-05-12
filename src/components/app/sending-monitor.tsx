"use client";

import { useEffect, useState } from "react";
import { Activity, Mail, MailCheck, MailOpen, MousePointerClick, ShieldOff, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/utils";

type ProgressResponse = {
  ok: boolean;
  campaign: { id: string; name: string; status: string; estimatedRecipients: number };
  progress: {
    total: number;
    sent: number;
    queued: number;
    failed: number;
    opened: number;
    clicked: number;
    delivered: number;
    suppressedConsent: number;
    suppressedApp: number;
    sentPct: number;
  };
  queue: { waiting: number; active: number };
  serverTime: string;
};

// Live progress card shown when a campaign is in SENDING state.
// Polls /api/campaigns/[id]/progress every 2 seconds. Stops polling on terminal status.
export function SendingMonitor({ campaignId, initialStatus }: { campaignId: string; initialStatus: string }) {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (initialStatus !== "SENDING" && initialStatus !== "APPROVED") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (stopped || paused) return;
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/progress`, { cache: "no-store" });
        const json = (await res.json()) as ProgressResponse;
        if (!stopped) setData(json);
        // Stop polling once the campaign reaches a terminal state.
        if (json.campaign.status === "SENT" || json.campaign.status === "FAILED" || json.campaign.status === "CANCELLED") {
          return;
        }
      } catch { /* ignore transient errors */ }
      timer = setTimeout(tick, 2_000);
    }
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [campaignId, initialStatus, paused]);

  if (initialStatus !== "SENDING" && initialStatus !== "APPROVED") return null;

  const p = data?.progress;
  const queue = data?.queue;
  const pct = p ? Math.round(p.sentPct * 100) : 0;

  async function cancel() {
    if (!confirm("Cancel this send? Already-sent emails can't be unsent.")) return;
    await fetch(`/api/campaigns/${campaignId}/cancel`, { method: "POST" });
  }

  return (
    <Card className="border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)]">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
            </span>
            Sending live
          </CardTitle>
          <CardDescription>Live ledger · polling every 2s</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPaused((x) => !x)}>
            {paused ? "Resume" : "Pause"} polling
          </Button>
          <Button variant="outline" size="sm" onClick={cancel} className="text-[color:var(--danger)]">
            <XCircle className="h-3.5 w-3.5" /> Cancel send
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium">{formatNumber(p?.sent ?? 0)} / {formatNumber(p?.total ?? data?.campaign.estimatedRecipients ?? 0)} sent</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Tile icon={Mail}          label="Queued"      value={p?.queued ?? 0}    />
          <Tile icon={MailCheck}     label="Delivered"   value={p?.delivered ?? 0} tone="positive" />
          <Tile icon={MailOpen}      label="Opened"      value={p?.opened ?? 0}    tone="accent" />
          <Tile icon={MousePointerClick} label="Clicked" value={p?.clicked ?? 0}   tone="accent" />
          <Tile icon={ShieldOff}     label="Failed"      value={p?.failed ?? 0}    tone={p && p.failed > 0 ? "danger" : undefined} />
        </div>

        <div className="rounded-md border border-border bg-card/40 p-3 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-3 w-3" />
            BullMQ depth: <span className="font-mono text-foreground">{queue?.active ?? 0} active</span> · <span className="font-mono text-foreground">{queue?.waiting ?? 0} waiting</span>
          </div>
          <Badge variant="muted">SES eu-west-1</Badge>
        </div>

        {p && (p.suppressedConsent > 0 || p.suppressedApp > 0) && (
          <div className="rounded-md border border-border bg-card/40 p-2.5 text-[11px] text-muted-foreground">
            Skipped at send time: {formatNumber(p.suppressedConsent)} consent · {formatNumber(p.suppressedApp)} app-recent
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "positive" | "accent" | "danger" }) {
  const color =
    tone === "positive" ? "var(--positive)" :
    tone === "accent"   ? "var(--accent)"   :
    tone === "danger"   ? "var(--danger)"   : undefined;
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-[18px] font-medium tabular-nums" style={color ? { color: `color-mix(in oklch, ${color} 90%, var(--fg))` } : undefined}>
        {formatNumber(value)}
      </div>
    </div>
  );
}
