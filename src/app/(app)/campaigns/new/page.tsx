"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe, Languages, Loader2, Save, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/page-header";
import { LANGUAGES } from "@/lib/languages";
import { STORES, SENDERS } from "@/lib/mock";
import { estimateCampaignCost } from "@/lib/cost";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

const STEPS = ["Audience", "Content", "Translations", "Review"] as const;

// New campaign wizard. Each step persists to a draft Campaign row in the DB. The "Submit
// for approval" button is the entry point to the approval pipeline.

export default function NewCampaignPage() {
  const [step, setStep] = useState(0);
  const [storeId, setStoreId] = useState(STORES[0].id);
  const [senderId, setSenderId] = useState(SENDERS.find((s) => s.storeId === STORES[0].id)?.id ?? SENDERS[0].id);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [excludeApp, setExcludeApp] = useState(true);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(
    LANGUAGES.filter((l) => l.code === "es-ES" || l.code === "en-GB").map((l) => l.code)
  );
  const [audience, setAudience] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const store = STORES.find((s) => s.id === storeId)!;
  const cost = useMemo(() => estimateCampaignCost({
    recipients: audience,
    languages: selectedLangs.length,
    cacheHitRate: 0.0,
    imagesGenerated: 1,
  }), [audience, selectedLangs.length]);

  async function saveDraft() {
    if (!name || !subject) {
      setError("name + subject obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, senderId, name, subject, preheader,
          languages: selectedLangs,
          excludeAppRecent: excludeApp,
          estimatedRecipients: audience,
          estimatedCost: cost.total,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "save failed");
      setSavedDraftId(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
        </Button>
        <PageHeader
          title="Nueva campaña"
          description="Sendify auto-traduce la fuente a cada idioma elegido, genera el banner con Nano Banana si lo pides, y retiene el envío hasta tu aprobación."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Guardando…" : savedDraftId ? "Draft guardado" : "Guardar draft"}
              </Button>
              <Button size="sm" disabled={step !== STEPS.length - 1 || !savedDraftId}>Submit for approval</Button>
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
                <CardHeader><CardTitle>Datos básicos</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Tienda">
                    <Select value={storeId} onValueChange={(v) => {
                      setStoreId(v);
                      const s = SENDERS.find((x) => x.storeId === v);
                      if (s) setSenderId(s.id);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Nombre de campaña *">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Día de la Madre — Europa" />
                  </Field>
                  <Field label="Sender">
                    <Select value={senderId} onValueChange={setSenderId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SENDERS.filter((s) => s.storeId === storeId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.fromName} &lt;{s.fromEmail}&gt;</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Audiencia estimada (manual, se recalculará con segmentos)">
                    <Input type="number" value={audience} onChange={(e) => setAudience(parseInt(e.target.value || "0", 10))} />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Segmentos</CardTitle>
                  <CardDescription>Selecciona segmentos a unir para construir la audiencia. Suppressions y app-recent se eliminan automáticamente.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-md border border-dashed border-border bg-card/40 p-4 text-center text-[12px] text-muted-foreground">
                    Aún no hay segmentos creados. Crea uno en <Link href="/segments" className="text-[color:var(--accent)] underline">/segments</Link> y vuelve.
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 p-2.5 mt-3">
                    <div>
                      <div className="text-[12px] font-medium">Excluir clientes con push en últimas 24h</div>
                      <div className="text-[10px] text-muted-foreground">Source: Shopify customer metafield <code className="text-[10px]">app.last_push_at</code>.</div>
                    </div>
                    <Switch checked={excludeApp} onCheckedChange={setExcludeApp} />
                  </label>
                </CardContent>
              </Card>
            </>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Asunto + preheader</CardTitle>
                <CardDescription>Idioma fuente: {store.defaultLanguage}. El resto se traducen automáticamente al renderizar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <Field label="Subject *">
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="ej: Para ella, perfume a 11,99€" />
                </Field>
                <Field label="Preheader (preview text)">
                  <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="ej: Selección Día de la Madre · envío gratis +30€" />
                </Field>
                <div className="rounded-md border border-dashed border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
                  Para diseñar el cuerpo del email, abre el <Link href="/builder" className="text-[color:var(--accent)] underline">builder</Link> y guarda como template.
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-muted-foreground" /> Idiomas</CardTitle>
                <CardDescription>{selectedLangs.length} de {LANGUAGES.length} seleccionados</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => {
                    const on = selectedLangs.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        onClick={() => setSelectedLangs((c) => on ? c.filter((x) => x !== l.code) : [...c, l.code])}
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
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Resumen</CardTitle><CardDescription>Guarda como draft o envía a aprobación</CardDescription></CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Summary label="Tienda" value={store.name} />
                <Summary label="Audiencia" value={`${formatNumber(audience)} destinatarios estimados${excludeApp ? " · push-suppression on" : ""}`} />
                <Summary label="Idiomas" value={`${selectedLangs.length} idiomas`} />
                <Summary label="Subject" value={subject || "—"} />
                <Summary label="Coste estimado" value={formatCurrency(cost.total)} />
                {error && <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-3 text-[11px] text-[color:var(--danger)]">{error}</div>}
                {savedDraftId && (
                  <div className="rounded-md border border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] p-3 text-[11px] text-[color:var(--positive)]">
                    ✓ Draft guardado · id <code className="font-mono">{savedDraftId}</code>
                  </div>
                )}
                <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] p-3 text-[11px]">
                  Aprobación obligatoria antes de enviar. Tú eres el aprobador. El envío se encola en BullMQ y se libera a SES en la fecha programada.
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft className="h-3.5 w-3.5" /> Atrás
            </Button>
            <Button size="sm" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Siguiente <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle><Sparkles className="h-3.5 w-3.5 inline text-[color:var(--accent)]" /> Coste estimado</CardTitle>
            <CardDescription>Se recalcula con cada cambio</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Stat label="Destinatarios"><span className="tabular-nums">{formatNumber(audience)}</span></Stat>
            <Stat label="Idiomas"><Badge variant="muted">{selectedLangs.length}</Badge></Stat>
            <Stat label="Caracteres a traducir"><span className="tabular-nums text-[12px]">{formatNumber(cost.charsToTranslate)}</span></Stat>
            <Stat label="SES"><span className="tabular-nums">{formatCurrency(cost.ses)}</span></Stat>
            <Stat label="DeepL"><span className="tabular-nums">{formatCurrency(cost.deepl)}</span></Stat>
            <Stat label="Gemini"><span className="tabular-nums">{formatCurrency(cost.gemini)}</span></Stat>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-[12px] font-medium">Total</span>
              <span className="text-[16px] font-medium tabular-nums">{formatCurrency(cost.total)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <Globe className="inline h-2.5 w-2.5 mr-1" />
              Cache hit asumido: 0% (sin envíos previos)
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
