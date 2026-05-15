"use client";

// Action row at the bottom of every campaign card in /approvals.
// Wired to the real endpoints (was three dummy buttons with no onClick).
//
// - Reject  → POST /api/campaigns/[id]/cancel
// - Edit    → navigate to /campaigns/[id] (subject/preheader/MJML editor lives there)
// - Approve → POST /api/campaigns/[id]/approve (kicks the translate→render→queue pipeline)

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send, X, Pencil, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApprovalRowActions({ campaignId, senderConfigured }: { campaignId: string; senderConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "reject" | "approve">(null);
  const [error, setError] = useState<string | null>(null);

  async function reject() {
    if (!confirm("¿Rechazar este draft? La campaña queda en estado CANCELLED y no se vuelve a tocar.")) return;
    setBusy("reject"); setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/cancel`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "reject failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!senderConfigured) {
      setError("Esta campaña no tiene sender asignado — configúralo en /settings antes de aprobar.");
      return;
    }
    if (!confirm("¿Aprobar y programar envío? Esto traduce a todos los idiomas, renderiza variantes y encola los Send rows.")) return;
    setBusy("approve"); setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/approve`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)] flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={reject} disabled={busy !== null}>
          {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Reject
        </Button>
        {/* asChild + disabled don't mix — disabled gets passed to the <a>
            which makes Next swallow the click. Plain Link wrapped in button
            classes instead. */}
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-secondary/60 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit before approving
        </Link>
        <Button size="sm" onClick={approve} disabled={busy !== null}>
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Approve & schedule
        </Button>
      </div>
    </div>
  );
}
