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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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

  // Split a long id list into bounded chunks. Approve is heavy (translate +
  // render + queue per campaign, ~10-30s each) so chunks of 10 keep each call
  // safely inside Vercel's 300s function cap. Cancel is cheap (DB update) so
  // 100/chunk is fine.
  async function runInChunks(
    ids: string[],
    chunkSize: number,
    endpoint: string,
    successField: "approved" | "cancelled",
  ): Promise<{ ok: number; failed: number; lastError?: string }> {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
    let ok = 0;
    let failed = 0;
    let lastError: string | undefined;
    let done = 0;
    setProgress({ done: 0, total: ids.length });
    for (const chunk of chunks) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          failed += chunk.length;
          lastError = j.error ?? `HTTP ${r.status}`;
        } else {
          ok += (j[successField] ?? 0) as number;
          failed += (j.failed?.length ?? 0) as number;
        }
      } catch (e) {
        failed += chunk.length;
        lastError = e instanceof Error ? e.message : "network";
      }
      done += chunk.length;
      setProgress({ done, total: ids.length });
    }
    return { ok, failed, lastError };
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    if (!confirm(`¿Aprobar ${selected.size} campaña${selected.size === 1 ? "" : "s"}? Esto traduce a los idiomas, renderiza variantes y encola los Send rows para cada una. ${selected.size > 10 ? `Se procesa en tandas de 10, tarda ~${Math.ceil(selected.size / 10) * 2} min en total.` : ""}`)) return;
    setBusy("approve"); setResult(null);
    const { ok, failed, lastError } = await runInChunks(Array.from(selected), 10, "/api/campaigns/bulk-approve", "approved");
    setResult({ ok, failed, message: lastError });
    if (failed === 0) clearAll();
    setProgress(null);
    setBusy(null);
    router.refresh();
  }

  async function bulkReject() {
    if (selected.size === 0) return;
    if (!confirm(`¿Rechazar ${selected.size} campaña${selected.size === 1 ? "" : "s"}? Quedan en estado CANCELLED y no se vuelven a tocar.`)) return;
    setBusy("reject"); setResult(null);
    const { ok, failed, lastError } = await runInChunks(Array.from(selected), 100, "/api/campaigns/bulk-cancel", "cancelled");
    setResult({ ok, failed, message: lastError });
    if (failed === 0) clearAll();
    setProgress(null);
    setBusy(null);
    router.refresh();
  }

  const allSelected = selected.size === allIds.length && allIds.length > 0;
  const someSelected = selected.size > 0;

  return (
    <BulkCtx.Provider value={ctx}>
      {/* Sticky bulk-action bar. Always visible; counts and buttons update
          live as the user ticks rows. Disabled buttons greyed out when no
          selection. */}
      <div className="sticky top-0 z-20 mb-2 rounded-md border border-border bg-card/95 backdrop-blur px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => allSelected ? clearAll() : selectAll()}
            className="h-3.5 w-3.5 rounded border-border"
          />
          <span>
            {someSelected
              ? <><span className="font-medium">{selected.size}</span> de {allIds.length}</>
              : <>Seleccionar las {allIds.length}</>}
          </span>
          {someSelected && (
            <button onClick={(e) => { e.preventDefault(); clearAll(); }} className="ml-1 text-[11px] text-muted-foreground hover:text-foreground underline">
              limpiar
            </button>
          )}
        </label>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={bulkReject}
            disabled={busy !== null || !someSelected}
            className="h-7 px-2.5 text-[12px] text-[color:var(--danger)] hover:text-[color:var(--danger)]"
          >
            {busy === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Reject{someSelected ? ` (${selected.size})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={bulkApprove}
            disabled={busy !== null || !someSelected}
            className="h-7 px-2.5 text-[12px]"
          >
            {busy === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Approve{someSelected ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>

      {progress && busy && (
        <div className="rounded-md border border-border bg-card/60 p-2.5 text-[12.5px] mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-medium">
              {busy === "approve" ? "Aprobando" : "Rechazando"} · {progress.done} de {progress.total}
            </span>
            <span className="text-muted-foreground tabular-nums">{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded bg-secondary overflow-hidden">
            <div
              className="h-full bg-foreground transition-[width] duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {result && !busy && (
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
