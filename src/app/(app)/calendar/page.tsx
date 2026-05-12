"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, Check, Plus, Sparkles, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { PROMOTIONS, STORES, CAMPAIGNS } from "@/lib/mock";
import { LANGUAGES, languagesForCountry } from "@/lib/languages";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOf(iso: string) {
  return parseInt(iso.slice(5, 7), 10) - 1;
}

export default function CalendarPage() {
  // Flatten all dated promotion entries to a timeline
  type Entry = { promoId: string; name: string; emoji: string; country: string; date: string; isoMonth: number };
  const entries: Entry[] = [];
  for (const p of PROMOTIONS) {
    for (const [country, date] of Object.entries(p.dateByCountry)) {
      entries.push({ promoId: p.id, name: p.name, emoji: p.emoji, country, date, isoMonth: monthOf(date) });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const byMonth: Record<number, Entry[]> = {};
  for (const e of entries) {
    (byMonth[e.isoMonth] ??= []).push(e);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotional calendar"
        description="Every key date for every country. Sendify drafts a campaign N days before each entry, translates per market, and queues it for your approval."
        actions={
          <>
            <Button variant="outline" size="sm"><Webhook className="h-3.5 w-3.5" /> Sync source</Button>
            <Button variant="outline" size="sm"><CalendarIcon className="h-3.5 w-3.5" /> 2026</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New promotion</Button>
          </>
        }
      />

      {/* Source banner */}
      <Card className="bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] border-[color:var(--accent)]/20">
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-card border border-border"><Webhook className="h-3.5 w-3.5 text-[color:var(--accent)]" /></span>
            <div>
              <div className="text-[13px] font-medium">Promotion source: <span className="font-mono">marketing-calendar</span></div>
              <div className="text-[11px] text-muted-foreground">Connected via webhook · last sync 4 min ago · 9 promotions synced</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">Configure → </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {MONTHS.map((m, idx) => {
          const items = byMonth[idx] ?? [];
          const grouped: Record<string, Entry[]> = {};
          for (const e of items) (grouped[e.promoId] ??= []).push(e);
          return (
            <Card key={m} className={items.length === 0 ? "opacity-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{m} 2026</CardTitle>
                  <CardDescription>{items.length === 0 ? "No promotions" : `${Object.keys(grouped).length} promotion${Object.keys(grouped).length > 1 ? "s" : ""}`}</CardDescription>
                </div>
                {items.length > 0 && <Badge variant="muted">{items.length} dates</Badge>}
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                {Object.entries(grouped).map(([promoId, dates]) => {
                  const p = PROMOTIONS.find((x) => x.id === promoId)!;
                  return <PromoCard key={promoId} promo={p} dates={dates} />;
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked campaigns</CardTitle>
          <CardDescription>Campaigns auto-drafted from promotion entries</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {CAMPAIGNS.filter((c) => c.promotionId).slice(0, 4).map((c) => {
            const store = STORES.find((s) => s.id === c.storeId);
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="flex items-center justify-between rounded-md border border-border bg-card/40 p-2.5 hover:bg-secondary/30 transition-colors">
                <div className="min-w-0 flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-[color:var(--accent)] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{store?.name} · {new Date(c.scheduledFor).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {LANGUAGES.slice(0, c.languages).slice(0, 5).map((l) => <span key={l.code} className="text-sm">{l.flag}</span>)}
                  {c.languages > 5 && <span className="text-[10px] text-muted-foreground">+{c.languages - 5}</span>}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function PromoCard({ promo, dates }: { promo: typeof PROMOTIONS[number]; dates: { country: string; date: string }[] }) {
  const [storeId, setStoreId] = useState(STORES[0].id);
  const [status, setStatus] = useState<"idle" | "drafting" | "drafted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setStatus("drafting");
    setError(null);
    try {
      const res = await fetch(`/api/promotions/${promo.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "draft failed");
      setStatus("drafted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none">{promo.emoji}</span>
          <div className="min-w-0">
            <div className="text-[12px] font-medium truncate">{promo.name}</div>
            <div className="text-[10px] text-muted-foreground">{promo.kind === "REGIONAL" ? "Date varies by country" : promo.kind === "GLOBAL" ? "Same date everywhere" : "Store-specific"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {dates.map((d) => {
          const langs = languagesForCountry(d.country);
          return (
            <div key={d.country + d.date} className="flex items-center gap-1.5 rounded border border-border bg-card px-1.5 py-1 text-[10px]">
              <span className="font-mono tabular-nums">{d.date.slice(8)}</span>
              <span className="text-muted-foreground">{d.country}</span>
              {langs[0] && <span className="opacity-70">{langs[0].flag}</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border pt-2">
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="h-7 flex-1 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={status === "drafted" ? "secondary" : "default"}
          disabled={status === "drafting"}
          onClick={draft}
          className={cn("h-7 px-2 text-[10px]", status === "drafted" && "text-[color:var(--positive)]")}
        >
          {status === "drafting" ? (
            <><Sparkles className="h-2.5 w-2.5 animate-pulse" /> Drafting…</>
          ) : status === "drafted" ? (
            <><Check className="h-2.5 w-2.5" /> Drafted</>
          ) : (
            <><Sparkles className="h-2.5 w-2.5" /> Auto-draft</>
          )}
        </Button>
      </div>
      {status === "drafted" && (
        <div className="mt-2 text-[10px] text-[color:var(--positive)]">
          ✓ Sent to <Link href="/approvals" className="underline">approvals</Link>
        </div>
      )}
      {error && <div className="mt-2 text-[10px] text-[color:var(--danger)]">{error}</div>}
    </div>
  );
}
