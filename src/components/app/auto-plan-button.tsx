"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AutoPlanResult = {
  ok: boolean;
  error?: string;
  planned?: Array<{ storeSlug: string; eventName: string; sendDate: string; subject: string; campaignId: string }>;
  skipped?: Array<{ storeSlug: string; eventSlug: string; reason: string }>;
  failed?:  Array<{ storeSlug: string; eventSlug: string; error: string }>;
};

export function AutoPlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AutoPlanResult | null>(null);

  async function run() {
    setBusy(true);
    setOpen(true);
    setResult(null);
    // Hard abort at 4.5 min so the UI doesn't sit forever if Vercel's 5-min
    // function timeout kicks in mid-generation.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 4.5 * 60_000);
    try {
      let res: Response;
      try {
        res = await fetch("/api/calendar/auto-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horizonDays: 30 }),
          signal: controller.signal,
        });
      } catch (netErr) {
        if (controller.signal.aborted) {
          throw new Error("Tardó más de 4.5 minutos — probablemente generaste muchos drafts a la vez. Reintenta y se procesan los que falten.");
        }
        throw new Error(`Servidor no responde (${netErr instanceof Error ? netErr.message : "network"})`);
      }
      // Parse defensively so Vercel's 504 HTML page surfaces as a readable
      // error instead of TypeError("Unexpected token <").
      const text = await res.text();
      let json: AutoPlanResult = { ok: false };
      try { json = JSON.parse(text) as AutoPlanResult; } catch {
        throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
      if (!res.ok && !json.error) json.error = `HTTP ${res.status}`;
      setResult(json);
      if (json.ok && json.planned && json.planned.length > 0) {
        router.refresh();
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "auto-plan failed" });
    } finally {
      clearTimeout(abortTimer);
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={run} disabled={busy} size="sm">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? "Planificando…" : "Plan próximos 30 días"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
              Auto-planner · resultados
            </DialogTitle>
          </DialogHeader>

          {busy && (
            <div className="py-8 flex items-center justify-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando drafts con IA…
            </div>
          )}

          {result && !busy && (
            <div className="space-y-3">
              {result.error && (
                <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[13px] text-[color:var(--danger)] flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {result.error}
                </div>
              )}

              {result.planned && result.planned.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" />
                    <h3 className="text-[14px] font-medium">Drafteado ({result.planned.length})</h3>
                  </div>
                  <div className="space-y-1.5">
                    {result.planned.map((p) => (
                      <div key={p.campaignId} className="rounded-md border border-border bg-card/40 p-2.5 text-[13px]">
                        <div className="font-medium">{p.eventName} · <span className="text-muted-foreground font-normal">{p.storeSlug}</span></div>
                        <div className="text-[12px] text-muted-foreground italic mt-0.5">&quot;{p.subject}&quot;</div>
                        <div className="text-[11px] text-muted-foreground mt-1">envío: {p.sendDate}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    Las tienes en <a href="/approvals" className="text-[color:var(--accent)] underline">/approvals</a> esperando tu OK.
                  </div>
                </section>
              )}

              {result.skipped && result.skipped.length > 0 && (() => {
                // Group skipped entries by reason category so the user sees the
                // shape of what needs fixing (vs reading 50 identical lines).
                const senderless: Record<string, number> = {};
                const future: typeof result.skipped = [];
                const alreadyDrafted: typeof result.skipped = [];
                const other: typeof result.skipped = [];
                for (const s of result.skipped) {
                  if (s.reason === "no verified sender on this store") {
                    senderless[s.storeSlug] = (senderless[s.storeSlug] ?? 0) + 1;
                  } else if (s.reason.startsWith("lead window opens")) {
                    future.push(s);
                  } else if (s.reason === "draft already exists") {
                    alreadyDrafted.push(s);
                  } else {
                    other.push(s);
                  }
                }
                const senderEntries = Object.entries(senderless);
                return (
                  <section className="space-y-2">
                    {senderEntries.length > 0 && (
                      <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] p-3 text-[12.5px]">
                        <div className="font-medium text-[color:var(--warning)] mb-1">
                          ⚠ Sin sender verificado en {senderEntries.length} store{senderEntries.length === 1 ? "" : "s"} — añade uno en /settings antes de poder enviar:
                        </div>
                        <ul className="ml-4 list-disc text-foreground/80">
                          {senderEntries.map(([slug, n]) => (
                            <li key={slug}><span className="font-mono">{slug}</span> · {n} draft{n === 1 ? "" : "s"} bloqueados</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {future.length > 0 && (
                      <details className="rounded-md border border-border bg-card/30">
                        <summary className="cursor-pointer text-[13px] px-3 py-2 text-muted-foreground">
                          Eventos futuros, fuera de la ventana de draft ({future.length}) — se draftearán automáticamente cuando entren en su lead window
                        </summary>
                        <div className="px-3 pb-3 space-y-1 text-[12px] text-muted-foreground">
                          {future.map((s, i) => (
                            <div key={i}><span className="font-mono">{s.storeSlug}</span> · {s.eventSlug} · <span className="italic">{s.reason}</span></div>
                          ))}
                        </div>
                      </details>
                    )}
                    {alreadyDrafted.length > 0 && (
                      <details className="rounded-md border border-border bg-card/30">
                        <summary className="cursor-pointer text-[13px] px-3 py-2 text-muted-foreground">
                          Ya estaban drafteados ({alreadyDrafted.length})
                        </summary>
                        <div className="px-3 pb-3 space-y-1 text-[12px] text-muted-foreground">
                          {alreadyDrafted.map((s, i) => (
                            <div key={i}><span className="font-mono">{s.storeSlug}</span> · {s.eventSlug}</div>
                          ))}
                        </div>
                      </details>
                    )}
                    {other.length > 0 && (
                      <div className="space-y-1 text-[12px] text-muted-foreground">
                        <div className="font-medium">Saltados ({other.length})</div>
                        {other.map((s, i) => (
                          <div key={i}><span className="font-mono">{s.storeSlug}</span> · {s.eventSlug} · <span className="italic">{s.reason}</span></div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })()}

              {result.failed && result.failed.length > 0 && (
                <section>
                  <h3 className="text-[13px] font-medium text-[color:var(--danger)] mb-1.5">Fallidos ({result.failed.length})</h3>
                  <div className="space-y-1">
                    {result.failed.map((f, i) => (
                      <div key={i} className="text-[12px] text-[color:var(--danger)] break-all">
                        <span className="font-mono">{f.storeSlug}</span> · {f.eventSlug}: {f.error}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.ok && (result.planned?.length ?? 0) === 0 && (result.failed?.length ?? 0) === 0 && (
                <div className="text-[13px] text-muted-foreground text-center py-3">
                  Nada que draftear hoy — todo lo de los próximos 30 días ya tiene un draft o no está aún en la ventana de lead.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
