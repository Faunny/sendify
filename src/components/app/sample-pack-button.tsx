"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Smartphone, Monitor, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Sample =
  | {
      id: string; label: string; ok: true;
      subject: string; preheader: string; layoutPattern?: string;
      bannerPrompt?: string; modelUsed: string;
      mjml: string; html: string; mjmlErrors: string[];
      tokensIn?: number; tokensOut?: number;
    }
  | { id: string; label: string; ok: false; error: string };

type SamplePackResult = { ok: boolean; storeSlug: string; samples: Sample[] };

export function SamplePackButton({ stores }: { stores: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SamplePackResult | null>(null);
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "divain-europa");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");

  async function run() {
    setBusy(true);
    setOpen(true);
    setResult(null);
    setActiveId(null);
    try {
      const res = await fetch("/api/templates/sample-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug }),
      });
      const json = (await res.json()) as SamplePackResult;
      setResult(json);
      const firstOk = json.samples.find((s) => s.ok);
      if (firstOk) setActiveId(firstOk.id);
    } catch (e) {
      setResult({
        ok: false, storeSlug,
        samples: [{ id: "err", label: "request failed", ok: false, error: e instanceof Error ? e.message : "network" }],
      });
    } finally {
      setBusy(false);
    }
  }

  const active = result?.samples.find((s) => s.id === activeId);

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <select
          value={storeSlug}
          onChange={(e) => setStoreSlug(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]"
        >
          {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy ? "Generando 4 previews…" : "Generar 4 previews"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
              Sample pack · 4 estéticas (no se guardan)
            </DialogTitle>
          </DialogHeader>

          {busy && (
            <div className="py-16 flex items-center justify-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              4 emails en paralelo · GPT-4o · ~15-25s…
            </div>
          )}

          {result && !busy && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 overflow-hidden">
              {/* Pattern tabs */}
              <aside className="space-y-2 overflow-y-auto">
                {result.samples.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.ok && setActiveId(s.id)}
                    disabled={!s.ok}
                    className={`w-full text-left rounded-md border p-3 transition-colors ${
                      activeId === s.id
                        ? "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]"
                        : "border-border bg-card/40 hover:bg-secondary/60"
                    } ${!s.ok ? "opacity-60" : ""}`}
                  >
                    <div className="text-[13px] font-medium leading-tight">{s.label}</div>
                    {s.ok ? (
                      <>
                        {s.layoutPattern && <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.layoutPattern}</div>}
                        <div className="mt-1.5 text-[12px] italic text-muted-foreground line-clamp-2">{s.subject}</div>
                      </>
                    ) : (
                      <div className="mt-1 text-[12px] text-[color:var(--danger)] flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {s.error}
                      </div>
                    )}
                  </button>
                ))}
              </aside>

              {/* Active preview */}
              <main className="flex flex-col overflow-hidden rounded-md border border-border bg-card/30">
                {active && active.ok ? (
                  <>
                    <div className="flex items-center justify-between gap-2 p-3 border-b border-border bg-card">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium truncate">{active.subject}</div>
                        <div className="text-[12px] text-muted-foreground truncate">{active.preheader}</div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          {active.layoutPattern} · {active.modelUsed}
                          {(active.tokensIn || active.tokensOut) && ` · ${active.tokensIn ?? "?"}→${active.tokensOut ?? "?"} tok`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")}>
                          <Smartphone className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")}>
                          <Monitor className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 bg-[color:var(--muted)] flex justify-center">
                      <div
                        className="bg-white rounded-md shadow"
                        style={{ width: device === "desktop" ? 620 : 380, maxWidth: "100%" }}
                      >
                        <iframe
                          srcDoc={active.html}
                          className="w-full"
                          style={{ height: "70vh", border: 0 }}
                          title={active.label}
                        />
                      </div>
                    </div>
                    {active.bannerPrompt && (
                      <details className="border-t border-border bg-card px-3 py-2">
                        <summary className="cursor-pointer text-[12px] text-muted-foreground flex items-center gap-1.5">
                          <Code className="h-3 w-3" /> Banner prompt (para Gemini)
                        </summary>
                        <div className="mt-2 text-[12px] font-mono leading-snug p-2 rounded bg-[color:var(--bg)] border border-border">
                          {active.bannerPrompt}
                        </div>
                      </details>
                    )}
                    {active.mjmlErrors.length > 0 && (
                      <div className="border-t border-border bg-[color-mix(in_oklch,var(--warning)_5%,transparent)] px-3 py-2 text-[11px] text-[color:var(--warning)]">
                        MJML warnings ({active.mjmlErrors.length}): {active.mjmlErrors.slice(0, 3).join(" · ")}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 grid place-items-center text-[13px] text-muted-foreground">
                    Selecciona una preview a la izquierda
                  </div>
                )}
              </main>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
