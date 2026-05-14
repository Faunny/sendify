"use client";

// Bulk "wipe & regenerate" with live progress.
//
// User feedback: previous version showed only a tiny spinner on the button
// while the DELETE + auto-plan ran for 3 minutes silently. No idea what
// was happening. Now opens a progress dialog with three explicit phases:
//   1. Borrando drafts viejos…
//   2. Generando primera tanda (X de Y drafts)…
//   3. Listo · cron termina los restantes en background

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Phase = "idle" | "deleting" | "drafting" | "done" | "error";

export function RegenerateDraftsButton({ label = "Regenerar drafts con diseño nuevo" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [deletedCount, setDeletedCount] = useState(0);
  const [planned, setPlanned] = useState(0);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function run() {
    if (!confirm("Borra los drafts pendientes auto-generados (no toca enviados ni manuales) y los vuelve a draftear con la paleta y diseño actual. Tarda ~3 min la primera tanda, el resto sigue en background. ¿Continuar?")) return;

    setOpen(true);
    setPhase("deleting");
    setDeletedCount(0); setPlanned(0); setPending(0); setError(null); setElapsed(0);

    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      // Phase 1: wipe existing drafts.
      const delRes = await fetch("/api/campaigns/auto-drafts", { method: "DELETE" });
      const delJson = await delRes.json().catch(() => ({}));
      if (!delRes.ok || !delJson.ok) throw new Error(delJson.error ?? `Delete failed: HTTP ${delRes.status}`);
      setDeletedCount(delJson.deleted ?? 0);

      // Phase 2: fire one auto-plan batch (the server-side processing
      // continues even if the user closes; cron drains the rest).
      setPhase("drafting");
      const planRes = await fetch("/api/calendar/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonDays: 30 }),
      });
      const text = await planRes.text();
      let planJson: {
        ok?: boolean;
        error?: string;
        planned?: unknown[];
        pendingCount?: number;
      } = {};
      try { planJson = JSON.parse(text); } catch {
        throw new Error(`Respuesta no JSON (HTTP ${planRes.status}): ${text.slice(0, 160)}`);
      }
      if (!planRes.ok || !planJson.ok) throw new Error(planJson.error ?? `Plan failed: HTTP ${planRes.status}`);

      setPlanned(planJson.planned?.length ?? 0);
      setPending(planJson.pendingCount ?? 0);
      setPhase("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "regenerate failed");
      setPhase("error");
    } finally {
      clearInterval(tick);
    }
  }

  const running = phase === "deleting" || phase === "drafting";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
        title="Borra drafts pendientes auto-generados y vuelve a draftear con el diseño / paleta / fotos actuales"
      >
        <RefreshCw className="h-3.5 w-3.5" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!running) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
              Regenerando drafts
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              Borra los drafts auto-generados pendientes y los rehace con la paleta y fotos actuales. Puedes cerrar — el cron del fondo termina lo que falte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Step
              icon={phase === "deleting" ? "spin" : phase === "idle" ? "wait" : "done"}
              title={phase === "idle" ? "Borrar drafts viejos" : phase === "deleting" ? "Borrando drafts viejos…" : `${deletedCount} drafts borrados`}
              detail="Sólo PENDING_APPROVAL con draftSource AUTO_*. Enviados / manuales intactos."
            />
            <Step
              icon={phase === "drafting" ? "spin" : phase === "done" || phase === "error" ? (phase === "error" ? "warn" : "done") : "wait"}
              title={
                phase === "drafting" ? `Generando primera tanda… ${elapsed}s` :
                phase === "done"     ? `${planned} drafts nuevos en esta tanda` :
                phase === "error"    ? "Fallo en la generación" :
                                       "Generar primera tanda (16 drafts)"
              }
              detail={
                phase === "drafting" ? "Cada draft: copy IA + render del hero con tu producto. ~3 min total." :
                phase === "done"     ? (pending > 0 ? `Quedan ~${pending} drafts pendientes — el cron los hace cada 5 min en background.` : "Cola vacía — todos los drafts a la vista en /approvals.") :
                                       "Copy + foto del frasco real por cada evento del calendario."
              }
            />
          </div>

          {error && (
            <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[12.5px] text-[color:var(--danger)] flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="default"
              onClick={() => setOpen(false)}
              disabled={running}
            >
              <X className="h-4 w-4" /> {running ? "Espera…" : "Cerrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ icon, title, detail }: { icon: "wait" | "spin" | "done" | "warn"; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card/40 p-3">
      <div className="grid h-7 w-7 place-items-center rounded-full shrink-0 mt-0.5">
        {icon === "spin" && <Loader2 className="h-4 w-4 animate-spin text-foreground" />}
        {icon === "done" && <Check className="h-4 w-4 text-[color:var(--positive)]" />}
        {icon === "warn" && <AlertTriangle className="h-4 w-4 text-[color:var(--danger)]" />}
        {icon === "wait" && <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
