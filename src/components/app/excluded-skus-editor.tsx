"use client";

import { useEffect, useState } from "react";
import { Plus, X, Loader2, Check, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Tag-style editor for the SKU patterns the AI generator should drop. Each
// pattern is a case-insensitive substring — paste "DIV-" and it excludes
// every variant SKU containing "DIV-".

export function ExcludedSkusEditor({
  storeSlug,
  storeName,
  initialPatterns,
}: {
  storeSlug: string;
  storeName: string;
  initialPatterns?: string[];
}) {
  const [patterns, setPatterns] = useState<string[]>(initialPatterns ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current patterns from the DB on mount so we never lie about what's
  // actually stored. The settings page is client-side and doesn't fetch.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${storeSlug}/excluded-skus`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        if (Array.isArray(j.patterns)) setPatterns(j.patterns);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storeSlug]);

  function add(rawValue: string) {
    const parts = rawValue.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setPatterns((cur) => {
      const next = [...cur];
      for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
      return next;
    });
    setDraft("");
  }

  function remove(p: string) {
    setPatterns((cur) => cur.filter((x) => x !== p));
  }

  async function save() {
    setBusy(true); setError(null); setSavedTick(false);
    try {
      const res = await fetch(`/api/stores/${storeSlug}/excluded-skus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patterns }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "save failed");
      setPatterns(json.store?.productExcludedSkuPatterns ?? patterns);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-[12px] font-medium">SKU patterns excluidos de la IA</div>
            <div className="text-[11px] text-muted-foreground">{storeName} · patrones case-insensitive, descartan productos para la generación de templates</div>
          </div>
        </div>
        {savedTick && <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {patterns.length === 0 && (
          <span className="text-[11px] text-muted-foreground italic">Sin patrones · todos los productos elegibles</span>
        )}
        {patterns.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-secondary/70 border border-border px-2 py-0.5 text-[11px] font-mono">
            {p}
            <button onClick={() => remove(p)} className="text-muted-foreground hover:text-[color:var(--danger)]"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder="Pega un patrón (ej: DIV-, MUESTRA, BOLSA) y Enter"
          className="text-[12px] h-7"
        />
        <Button variant="outline" size="sm" onClick={() => add(draft)} disabled={!draft.trim()} className="h-7 px-2 shrink-0">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)] flex items-start gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{patterns.length} patrón{patterns.length === 1 ? "" : "es"}</span>
        <Button size="sm" onClick={save} disabled={busy} className="h-7 px-3 text-[11px]">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
