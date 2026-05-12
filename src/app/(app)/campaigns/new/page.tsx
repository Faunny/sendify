"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Check, Globe, Image as ImageIcon, Languages, Save, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/page-header";
import { LANGUAGES } from "@/lib/languages";
import { STORES, SEGMENTS, SENDERS, PROMOTIONS, ASSETS } from "@/lib/mock";
import { estimateCampaignCost } from "@/lib/cost";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

const STEPS = ["Audience", "Content", "Translations", "Review"] as const;

export default function NewCampaignPage() {
  const [step, setStep] = useState(0);
  const [storeId, setStoreId] = useState(STORES[0].id);
  const [name, setName] = useState("Día de la Madre — Multicountry");
  const [subject, setSubject] = useState("Para ella, lo que de verdad le emociona");
  const [excludeApp, setExcludeApp] = useState(true);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([SEGMENTS[0].id]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(LANGUAGES.slice(0, 8).map((l) => l.code));
  const [promotionId, setPromotionId] = useState<string>(PROMOTIONS[0].id);

  const audience = useMemo(
    () => SEGMENTS.filter((s) => selectedSegments.includes(s.id)).reduce((sum, s) => sum + s.size, 0),
    [selectedSegments]
  );

  const cost = useMemo(() => estimateCampaignCost({
    recipients: audience,
    languages: selectedLangs.length,
    cacheHitRate: 0.71,
    imagesGenerated: 1,
  }), [audience, selectedLangs.length]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
        </Button>
        <PageHeader
          title="New campaign"
          description="Sendify auto-translates the source into every selected language, generates banners with Nano Banana if you ask, and holds the send until you approve."
          actions={
            <>
              <Button variant="outline" size="sm"><Save className="h-3.5 w-3.5" /> Save draft</Button>
              <Button size="sm" disabled={step !== STEPS.length - 1}>Submit for approval</Button>
            </>
          }
        />
      </div>

      {/* Stepper */}
      <ol className="grid grid-cols-4 rounded-lg border border-border bg-card overflow-hidden">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={s} className={cn(
              "px-4 py-3 flex items-center gap-3 border-r border-border last:border-r-0 cursor-pointer transition-colors",
              active && "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]",
              !active && "hover:bg-secondary/40"
            )} onClick={() => setStep(i)}>
              <span className={cn(
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-medium",
                done ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)]" : active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("text-[12px]", active && "font-medium")}>{s}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {step === 0 && (
            <>
              <Card>
                <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Store">
                    <Select value={storeId} onValueChange={setStoreId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Campaign name">
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Sender">
                    <Select defaultValue={SENDERS.find((s) => s.storeId === storeId)?.id ?? SENDERS[0].id}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SENDERS.filter((s) => s.storeId === storeId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.fromName} &lt;{s.fromEmail}&gt;</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Audience</CardTitle>
                  <CardDescription>Pick segments to union. Suppressions and app-recent customers are removed automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {SEGMENTS.filter((s) => s.storeId === storeId).map((s) => {
                    const checked = selectedSegments.includes(s.id);
                    return (
                      <label key={s.id} className={cn(
                        "flex items-center gap-3 rounded-md border border-border bg-card/40 p-2.5 cursor-pointer transition-colors",
                        checked && "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]"
                      )}>
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          setSelectedSegments(c => e.target.checked ? [...c, s.id] : c.filter(x => x !== s.id));
                        }} className="accent-[color:var(--accent)]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">{s.description}</div>
                        </div>
                        <span className="text-[12px] tabular-nums">{formatNumber(s.size)}</span>
                      </label>
                    );
                  })}

                  <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 p-2.5 mt-3">
                    <div>
                      <div className="text-[12px] font-medium">Exclude app users with push in last 24h</div>
                      <div className="text-[10px] text-muted-foreground">Avoids double-notifying. Source: Shopify customer metafield <code className="text-[10px]">app.last_push_at</code>.</div>
                    </div>
                    <Switch checked={excludeApp} onCheckedChange={setExcludeApp} />
                  </label>
                </CardContent>
              </Card>
            </>
          )}

          {step === 1 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Subject & preheader</CardTitle>
                  <CardDescription>Source language: Spanish (Spain). Other 21 languages are translated automatically at render time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Subject">
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
                  </Field>
                  <Field label="Preheader (preview text)">
                    <Input placeholder="Aparece junto al asunto en la bandeja de entrada…" />
                  </Field>
                  <Field label="Linked promotion">
                    <Select value={promotionId} onValueChange={setPromotionId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROMOTIONS.map((p) => <SelectItem key={p.id} value={p.id}>{p.emoji} {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Hero banner</CardTitle>
                  <CardDescription>Pick from library or generate a fresh one with Gemini.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button className="aspect-[3/2] rounded-md border-2 border-dashed border-border bg-card/40 grid place-items-center text-[11px] text-muted-foreground hover:bg-secondary/40">
                      <span className="flex flex-col items-center gap-1">
                        <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
                        Generate
                      </span>
                    </button>
                    {ASSETS.slice(0, 7).map((a) => (
                      <button key={a.id} className="aspect-[3/2] rounded-md border border-border overflow-hidden bg-cover bg-center" style={{ backgroundImage: `url(${a.url})` }} title={a.name} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-muted-foreground" /> Languages</CardTitle>
                <CardDescription>{selectedLangs.length} of {LANGUAGES.length} selected · cached translations reused automatically</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => {
                    const on = selectedLangs.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        onClick={() => setSelectedLangs(c => on ? c.filter(x => x !== l.code) : [...c, l.code])}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                          on ? "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-foreground" : "border-border bg-card/40 text-muted-foreground hover:bg-secondary/40"
                        )}
                      >
                        <span>{l.flag}</span>
                        {l.label}
                        {on && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-card/40 p-3">
                  <div className="text-[11px] text-muted-foreground">
                    Auto-translation provider: <span className="text-foreground">DeepL Pro</span> with brand glossary <span className="text-foreground">divain-brand</span> · GPT-4 review for promotional copy
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Review</CardTitle><CardDescription>Submit to send the campaign for approval</CardDescription></CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Summary label="Store" value={STORES.find(s => s.id === storeId)?.name ?? ""} />
                <Summary label="Audience" value={`${formatNumber(audience)} recipients · ${selectedSegments.length} segment${selectedSegments.length > 1 ? "s" : ""}${excludeApp ? " · push-suppression on" : ""}`} />
                <Summary label="Languages" value={`${selectedLangs.length} languages`} />
                <Summary label="Subject" value={subject} />
                <Summary label="Estimated cost" value={formatCurrency(cost.total)} />
                <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] p-3 text-[11px]">
                  Approval required before any email goes out. You will be the approver. The send will be queued in BullMQ and released to SES at the scheduled time.
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" disabled={step === STEPS.length - 1} onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Live cost panel */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Live estimate</CardTitle>
            <CardDescription>Updates as you build</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Stat label="Recipients"><span className="tabular-nums">{formatNumber(audience)}</span></Stat>
            <Stat label="Languages"><Badge variant="muted">{selectedLangs.length}</Badge></Stat>
            <Stat label="Translation chars"><span className="tabular-nums text-[12px]">{formatNumber(cost.charsToTranslate)}</span></Stat>
            <Stat label="SES"><span className="tabular-nums">{formatCurrency(cost.ses)}</span></Stat>
            <Stat label="DeepL"><span className="tabular-nums">{formatCurrency(cost.deepl)}</span></Stat>
            <Stat label="Gemini"><span className="tabular-nums">{formatCurrency(cost.gemini)}</span></Stat>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[12px] font-medium">Total</span>
              <span className="text-[16px] font-medium tabular-nums">{formatCurrency(cost.total)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <Globe className="inline h-2.5 w-2.5 mr-1" />
              Cache hit assumed: 71% (last 30d avg)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[13px] text-right max-w-[60%]">{value}</span>
    </div>
  );
}
