"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, AlertTriangle, Mail, Code2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState<typeof PILLARS[number]["value"]>("PARFUMS");
  const [tone, setTone] = useState<typeof TONES[number]>("editorial-cálido");
  const [storeSlug, setStoreSlug] = useState<string>(stores[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subject: string; preheader: string; mjml: string; templateId?: string; modelUsed: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // When a result lands, compile the MJML to HTML so the dialog can show
  // an actual rendered preview (iframe) instead of raw source code. The user
  // is a designer/owner, not a coder — she wants to see the email, not MJML.
  useEffect(() => {
    if (!result?.mjml) { setPreviewHtml(""); return; }
    let cancelled = false;
    setPreviewBusy(true);
    fetch("/api/templates/render-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mjml: result.mjml }),
    })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.ok && typeof j.html === "string") setPreviewHtml(j.html); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [result?.mjml]);

  // Tick a second-by-second counter while busy so the user sees the request is
  // actively running (gen-with-image-ref can take 60-90s, not 12).
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy]);

  async function generate() {
    setError(null); setResult(null); setBusy(true);
    // Hard timeout — abort after 4 minutes so a stuck Gemini call doesn't
    // pin the UI forever. Vercel's function timeout is 5 min so we cut a
    // little earlier and surface a clean error instead of a network hang.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 4 * 60_000);
    try {
      let res: Response;
      try {
        res = await fetch("/api/templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief, pillar, tone, storeSlug, name: name || undefined }),
          signal: controller.signal,
        });
      } catch (netErr) {
        if (controller.signal.aborted) {
          throw new Error("La generación tardó más de 4 minutos. Revisa quotas (OpenAI/Gemini/DeepSeek) y vuelve a intentar.");
        }
        throw new Error(`Servidor no responde (${netErr instanceof Error ? netErr.message : "network"}) — espera el deploy y reintenta.`);
      }
      // Parse defensively — a 504 / function crash returns HTML and a naive
      // res.json() throws "Unexpected token <" which hides the real cause.
      const text = await res.text();
      let json: { ok?: boolean; error?: string; subject?: string; preheader?: string; mjml?: string; templateId?: string; modelUsed?: string } = {};
      try { json = JSON.parse(text); } catch {
        throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult({
        subject: json.subject ?? "", preheader: json.preheader ?? "", mjml: json.mjml ?? "",
        templateId: json.templateId, modelUsed: json.modelUsed ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "generation failed");
    } finally {
      clearTimeout(abortTimer);
      setBusy(false);
    }
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

              <div className="flex items-center justify-between border-t border-border pt-3 gap-3">
                <div className="text-[12px] text-muted-foreground leading-relaxed">
                  {busy ? (
                    <>
                      <span className="text-foreground font-medium">{elapsed < 12 ? "Generando copy y elección de layout…" : elapsed < 45 ? "Componiendo el hero con tu producto…" : elapsed < 90 ? "Casi listo, terminando la imagen…" : "Tardando más de lo normal — revisa quotas en Settings"}</span>
                      <br/>
                      <span className="tabular-nums">{elapsed}s transcurridos · timeout en 4 min</span>
                    </>
                  ) : (
                    <>Usa <strong className="text-foreground">DeepSeek</strong> + <strong className="text-foreground">Gemini</strong> · ~$0.005 · 30-60s con tu producto en la imagen</>
                  )}
                </div>
                <Button onClick={generate} disabled={busy || brief.trim().length < 8}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {busy ? `Generando… ${elapsed}s` : "Generar"}
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

              {/* Rendered email preview — what the user actually wants to see. */}
              <div className="rounded-md border border-border bg-[color:var(--muted)] overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Preview {previewBusy && "· renderizando…"}
                  </span>
                  <button onClick={() => setShowCode((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Code2 className="h-3 w-3" /> {showCode ? "Ocultar código" : "Ver código"}
                  </button>
                </div>
                <div className="p-3 flex justify-center">
                  <div className="bg-white rounded shadow w-full max-w-[600px]">
                    <iframe
                      srcDoc={previewHtml || "<div style=\"padding:24px;color:#666;font-family:sans-serif\">Renderizando…</div>"}
                      className="w-full"
                      style={{ minHeight: "480px", border: 0 }}
                      title="preview"
                    />
                  </div>
                </div>
                {showCode && (
                  <pre className="text-[11px] font-mono p-3 max-h-64 overflow-auto bg-[color:var(--bg)] border-t border-border whitespace-pre-wrap break-all">
                    {result.mjml}
                  </pre>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button variant="outline" size="default" onClick={() => { setResult(null); setBrief(""); }}>
                  Generar otra
                </Button>
                {result.templateId ? (
                  <Button asChild size="default">
                    <Link href={`/templates/${result.templateId}/edit`} onClick={() => setOpen(false)}>
                      <Mail className="h-4 w-4" /> Editar y enviar →
                    </Link>
                  </Button>
                ) : (
                  <Button disabled size="default">
                    <Mail className="h-4 w-4" /> Sin guardar en DB
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
