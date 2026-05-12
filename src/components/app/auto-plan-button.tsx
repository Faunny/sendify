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
    try {
      const res = await fetch("/api/calendar/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonDays: 30 }),
      });
      const json = await res.json() as AutoPlanResult;
      setResult(json);
      if (json.ok && json.planned && json.planned.length > 0) {
        router.refresh();
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "auto-plan failed" });
    } finally {
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
            <div className="py-8 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando drafts con IA…
            </div>
          )}

          {result && !busy && (
            <div className="space-y-3">
              {result.error && (
                <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[12px] text-[color:var(--danger)] flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {result.error}
                </div>
              )}

              {result.planned && result.planned.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" />
                    <h3 className="text-[13px] font-medium">Drafteado ({result.planned.length})</h3>
                  </div>
                  <div className="space-y-1.5">
                    {result.planned.map((p) => (
                      <div key={p.campaignId} className="rounded-md border border-border bg-card/40 p-2.5 text-[12px]">
                        <div className="font-medium">{p.eventName} · <span className="text-muted-foreground font-normal">{p.storeSlug}</span></div>
                        <div className="text-[11px] text-muted-foreground italic mt-0.5">&quot;{p.subject}&quot;</div>
                        <div className="text-[10px] text-muted-foreground mt-1">envío: {p.sendDate}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Las tienes en <a href="/approvals" className="text-[color:var(--accent)] underline">/approvals</a> esperando tu OK.
                  </div>
                </section>
              )}

              {result.skipped && result.skipped.length > 0 && (
                <section>
                  <h3 className="text-[12px] font-medium text-muted-foreground mb-1.5">Saltados ({result.skipped.length})</h3>
                  <div className="space-y-1">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{s.storeSlug}</span> · {s.eventSlug} · <span className="italic">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.failed && result.failed.length > 0 && (
                <section>
                  <h3 className="text-[12px] font-medium text-[color:var(--danger)] mb-1.5">Fallidos ({result.failed.length})</h3>
                  <div className="space-y-1">
                    {result.failed.map((f, i) => (
                      <div key={i} className="text-[11px] text-[color:var(--danger)] break-all">
                        <span className="font-mono">{f.storeSlug}</span> · {f.eventSlug}: {f.error}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.ok && (result.planned?.length ?? 0) === 0 && (result.failed?.length ?? 0) === 0 && (
                <div className="text-[12px] text-muted-foreground text-center py-3">
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
