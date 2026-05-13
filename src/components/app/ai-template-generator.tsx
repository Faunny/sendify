"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertTriangle, Mail, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PILLARS = [
  { value: "PARFUMS", label: "divain. PARFUMS", desc: "Fragancias mujer / hombre / unisex" },
  { value: "CARE",    label: "divain. CARE",    desc: "Skincare + body" },
  { value: "HOME",    label: "divain. HOME",    desc: "Velas, difusores, hogar" },
  { value: "RITUAL",  label: "divain. RITUAL",  desc: "Set premium · regalo" },
  { value: "ALL",     label: "Toda la marca",   desc: "Newsletter general · marca completa" },
] as const;

const TONES = [
  "editorial-cálido", "comercial-directo", "lujo-minimalista", "urgente-flash",
];

const EXAMPLE_BRIEFS = [
  "Día de la Madre · 15% off en perfumes femeninos · tono cálido y emocional · CTA principal: ver colección regalos",
  "Black Friday · 30% en todo el catálogo · sentido de urgencia · countdown · top 5 perfumes más vendidos",
  "Lanzamiento RITUAL Edition · set premium edición limitada · enfoque lujo · 1 CTA grande · sin precio",
  "Welcome series · primer email tras subscripción · cupón -10% · presentación de los 4 pilares",
  "Win-back · clientes 60-120 días sin comprar · -15% · empático no agresivo",
];

export function AiTemplateGenerator({ stores }: { stores: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState<typeof PILLARS[number]["value"]>("PARFUMS");
  const [tone, setTone] = useState<typeof TONES[number]>("editorial-cálido");
  const [storeSlug, setStoreSlug] = useState<string>(stores[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subject: string; preheader: string; mjml: string; templateId?: string; modelUsed: string } | null>(null);

  async function generate() {
    setError(null); setResult(null); setBusy(true);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, pillar, tone, storeSlug, name: name || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "generation failed");
      setResult({
        subject: json.subject, preheader: json.preheader, mjml: json.mjml,
        templateId: json.templateId, modelUsed: json.modelUsed,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "generation failed");
    } finally {
      setBusy(false);
    }
  }

  function openInBuilder() {
    if (!result?.templateId) return;
    router.push(`/templates/${result.templateId}/edit`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Sparkles className="h-3.5 w-3.5" /> Generar con IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
              Generar plantilla de email con IA
            </DialogTitle>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] uppercase tracking-wider text-muted-foreground mb-1.5">Brief</label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-[14px] resize-none focus:outline-none focus:border-[color:var(--accent)]"
                  placeholder="Describe el email: evento, audiencia, oferta, tono..."
                  autoFocus
                />
                <div className="mt-2 text-[12px] text-muted-foreground">Ejemplos rápidos:</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {EXAMPLE_BRIEFS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrief(b)}
                      className="text-[12px] px-2 py-1 rounded-md border border-border bg-card/40 hover:bg-secondary/60 text-left leading-snug max-w-[280px]"
                      title={b}
                    >
                      {b.slice(0, 36)}…
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] uppercase tracking-wider text-muted-foreground mb-1.5">Pilar de marca</label>
                  <select value={pillar} onChange={(e) => setPillar(e.target.value as typeof pillar)} className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                    {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <div className="text-[12px] text-muted-foreground mt-1">{PILLARS.find((p) => p.value === pillar)?.desc}</div>
                </div>
                <div>
                  <label className="block text-[13px] uppercase tracking-wider text-muted-foreground mb-1.5">Tono</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                    {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] uppercase tracking-wider text-muted-foreground mb-1.5">Tienda destino (footer)</label>
                  <select value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                    {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] uppercase tracking-wider text-muted-foreground mb-1.5">Nombre (opcional)</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-generado si vacío" className="text-[14px]" />
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[13px] text-[color:var(--danger)] flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="text-[12px] text-muted-foreground">
                  Usa <strong className="text-foreground">DeepSeek</strong> (configurado) · ~$0.003 por generación · ~12 segundos
                </div>
                <Button onClick={generate} disabled={busy || brief.trim().length < 8}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {busy ? "Generando…" : "Generar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_6%,transparent)] p-3">
                <div className="text-[12px] uppercase tracking-wider text-[color:var(--positive)] mb-1">✓ Plantilla generada · {result.modelUsed}</div>
                <div className="text-[14px] font-medium">{result.subject}</div>
                <div className="text-[13px] text-muted-foreground mt-0.5">{result.preheader}</div>
              </div>

              <details className="rounded-md border border-border bg-card/40">
                <summary className="cursor-pointer text-[13px] px-3 py-2 flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" /> Ver MJML generado ({result.mjml.length.toLocaleString()} caracteres)
                </summary>
                <pre className="text-[12px] font-mono p-3 max-h-64 overflow-auto bg-[color:var(--bg)] border-t border-border whitespace-pre-wrap break-all">
                  {result.mjml}
                </pre>
              </details>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => { setResult(null); setBrief(""); }}>
                  Generar otra
                </Button>
                <Button onClick={openInBuilder} disabled={!result.templateId}>
                  <Mail className="h-3.5 w-3.5" /> Abrir en builder →
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
