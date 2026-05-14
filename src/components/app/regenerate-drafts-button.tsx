"use client";

// Bulk "wipe & regenerate" — used in /calendar and /approvals as a more
// discoverable entry than the one buried in the auto-plan dialog footer.
// Deletes every PENDING_APPROVAL row whose draftSource is AUTO_* and
// immediately fires one auto-plan batch so drafts start refilling. Cron
// finishes the rest in background.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegenerateDraftsButton({ label = "Regenerar drafts con diseño nuevo" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm("Borra los drafts pendientes auto-generados (no toca enviados ni manuales) y vuelve a draftear con el diseño actual. Tarda ~3 min la primera tanda, el resto sigue en background. ¿Continuar?")) return;
    setBusy(true);
    try {
      await fetch("/api/campaigns/auto-drafts", { method: "DELETE" });
      // Kick the planner once. Vercel finishes the function even if we leave
      // the page; cron handles whatever doesn't fit in this first batch.
      await fetch("/api/calendar/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonDays: 30 }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={busy}
      className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
      title="Borra drafts pendientes auto-generados y vuelve a draftear con el diseño / paleta / fotos actuales"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
