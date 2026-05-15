"use client";

// Selection wrapper for /approvals. Wraps the campaign cards in a context so
// each row can render a checkbox and the top bar can render bulk Approve /
// Reject buttons + "Select all". Cleaner than building 50 per-row clicks.

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type BulkContextValue = {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
};
const BulkCtx = createContext<BulkContextValue | null>(null);

export function useBulkSelection() {
  const ctx = useContext(BulkCtx);
  // Outside the provider (e.g. detail page) selection is a no-op.
  if (!ctx) {
    return {
      isSelected: () => false,
      toggle: () => {},
      withinBulk: false,
    };
  }
  return { ...ctx, withinBulk: true };
}

export function ApprovalsBulkProvider({
  allIds,
  children,
}: {
  allIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [result, setResult] = useState<{ ok: number; failed: number; message?: string } | null>(null);

  const ctx = useMemo<BulkContextValue>(() => ({
    selectedIds: selected,
    toggle: (id) => setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    isSelected: (id) => selected.has(id),
  }), [selected]);

  function selectAll() { setSelected(new Set(allIds)); }
  function clearAll() { setSelected(new Set()); }

  async function bulkApprove() {
    if (selected.size === 0) return;
    if (!confirm(`¿Aprobar ${selected.size} campaña${selected.size === 1 ? "" : "s"}? Esto traduce a los idiomas, renderiza variantes y encola los Send rows para cada una.`)) return;
    setBusy("approve"); setResult(null);
    try {
      const r = await fetch("/api/campaigns/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setResult({ ok: j.approved, failed: (j.failed?.length ?? 0), message: j.failed?.length ? `${j.failed?.length} fallidas (ver detalles en /campaigns)` : undefined });
      clearAll();
      router.refresh();
    } catch (e) {
      setResult({ ok: 0, failed: selected.size, message: e instanceof Error ? e.message : "approve failed" });
    } finally {
      setBusy(null);
    }
  }

  async function bulkReject() {
    if (selected.size === 0) return;
    if (!confirm(`¿Rechazar ${selected.size} campaña${selected.size === 1 ? "" : "s"}? Quedan en estado CANCELLED y no se vuelven a tocar.`)) return;
    setBusy("reject"); setResult(null);
    try {
      const r = await fetch("/api/campaigns/bulk-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setResult({ ok: j.cancelled, failed: (j.failed?.length ?? 0) });
      clearAll();
      router.refresh();
    } catch (e) {
      setResult({ ok: 0, failed: selected.size, message: e instanceof Error ? e.message : "reject failed" });
    } finally {
      setBusy(null);
    }
  }

  const allSelected = selected.size === allIds.length && allIds.length > 0;
  const someSelected = selected.size > 0;

  return (
    <BulkCtx.Provider value={ctx}>
      {/* Sticky bulk-action bar. Always visible; counts and buttons update
          live as the user ticks rows. Disabled buttons greyed out when no
          selection. */}
      <div className="sticky top-0 z-20 -mx-1 mb-2 rounded-md border border-border bg-card/95 backdrop-blur p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => allSelected ? clearAll() : selectAll()}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">
              {someSelected
                ? `${selected.size} seleccionada${selected.size === 1 ? "" : "s"} de ${allIds.length}`
                : `Seleccionar las ${allIds.length}`}
            </span>
          </label>
          {someSelected && (
            <button onClick={clearAll} className="text-[12px] text-muted-foreground hover:text-foreground underline">
              limpiar selección
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={bulkReject}
            disabled={busy !== null || !someSelected}
            className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
          >
            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Reject {someSelected ? `(${selected.size})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={bulkApprove}
            disabled={busy !== null || !someSelected}
          >
            {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Approve {someSelected ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`rounded-md border p-2.5 text-[12.5px] mb-2 flex items-start gap-2 ${result.failed === 0 ? "border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] text-[color:var(--positive)]" : "border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] text-[color:var(--warning)]"}`}>
          {result.failed === 0 ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span>
            {result.ok > 0 && <>{result.ok} OK · </>}
            {result.failed > 0 && <>{result.failed} fallidas</>}
            {result.message && ` · ${result.message}`}
          </span>
        </div>
      )}

      {children}
    </BulkCtx.Provider>
  );
}

// Per-card checkbox. Drop this in next to the campaign card header so each
// row gets a tick mark wired to the same provider.
export function ApprovalRowCheckbox({ id }: { id: string }) {
  const { isSelected, toggle, withinBulk } = useBulkSelection();
  if (!withinBulk) return null;
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center h-6 w-6 cursor-pointer shrink-0"
    >
      <input
        type="checkbox"
        checked={isSelected(id)}
        onChange={() => toggle(id)}
        className="h-4 w-4 rounded border-border"
      />
    </label>
  );
}
