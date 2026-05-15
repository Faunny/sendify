"use client";

// One-click newsletter generator. Picks latest products + latest blog posts
// from the store and asks the LLM to compose an editorial newsletter (no
// promo, no urgency). Lands as PENDING_APPROVAL in /approvals.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Newspaper, Loader2, Check, AlertTriangle, X, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";

export type StoreOption = { slug: string; name: string };

export function NewsletterDraftButton({ stores }: { stores: StoreOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "");
  const [kind, setKind] = useState<"weekly-digest" | "new-arrivals">("weekly-digest");
  const [customBrief, setCustomBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; campaignId?: string; subject?: string; productsUsed?: number; postsUsed?: number; error?: string } | null>(null);

  async function generate() {
    setBusy(true);
    setResult(null);
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const r = await fetch("/api/newsletters/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug, kind, customBrief: customBrief.trim() || undefined }),
      });
      const text = await r.text();
      let j: { ok?: boolean; error?: string; campaignId?: string; subject?: string; productsUsed?: number; postsUsed?: number } = {};
      try { j = JSON.parse(text); } catch {
        throw new Error(`Respuesta no JSON (HTTP ${r.status}): ${text.slice(0, 160)}`);
      }
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setResult({ ok: true, campaignId: j.campaignId, subject: j.subject, productsUsed: j.productsUsed, postsUsed: j.postsUsed });
      router.refresh();
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "newsletter failed" });
    } finally {
      clearInterval(t);
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Newspaper className="h-3.5 w-3.5" /> Newsletter
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Newspaper className="h-4 w-4" /> Generar newsletter
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Toma los últimos productos sincronizados de Shopify + entradas recientes del blog ({"/blogs/news.atom"}) y compone un newsletter editorial sin descuento. Sale como draft en /approvals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Store</span>
                <Select value={storeSlug} onValueChange={setStoreSlug}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.slug} value={s.slug} className="text-[13px]">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Tipo</span>
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly-digest" className="text-[13px]">Semanal · digest</SelectItem>
                    <SelectItem value="new-arrivals" className="text-[13px]">Nuevas llegadas</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Notas extra (opcional)</span>
              <Input
                value={customBrief}
                onChange={(e) => setCustomBrief(e.target.value)}
                placeholder={"Ej: 'menciona el nuevo set RITUAL otoño'"}
                className="mt-1 h-9 text-[13px]"
              />
            </label>

            {result?.ok && (
              <div className="rounded-md border border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] p-3 text-[12.5px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[color:var(--positive)] font-medium">
                  <Check className="h-3.5 w-3.5" /> Newsletter creado
                </div>
                <div className="text-foreground/90">&ldquo;{result.subject}&rdquo;</div>
                <div className="text-muted-foreground text-[11.5px]">
                  {result.productsUsed} producto{result.productsUsed === 1 ? "" : "s"} · {result.postsUsed ?? 0} post{result.postsUsed === 1 ? "" : "s"} del blog
                </div>
              </div>
            )}
            {result && !result.ok && (
              <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[12.5px] text-[color:var(--danger)] flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{result.error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="text-[11px] text-muted-foreground">
              {busy ? (
                <>
                  {elapsed < 12 ? "Cargando contenido de Shopify…" : elapsed < 30 ? "Escribiendo copy…" : "Generando hero…"}
                  {" · "}{elapsed}s
                </>
              ) : (
                <>~40s · usa Gemini + tu producto real</>
              )}
            </div>
            <div className="flex items-center gap-2">
              {result?.ok ? (
                <Button size="sm" asChild>
                  <Link href={`/approvals`} onClick={() => setOpen(false)}>
                    Ver en Approvals <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                    <X className="h-3.5 w-3.5" /> Cerrar
                  </Button>
                  <Button size="sm" onClick={generate} disabled={busy || !storeSlug}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Generar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
