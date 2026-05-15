"use client";

// Pool-depth heatmap for the asset library. Shows every (layoutPattern × store)
// combo with how many UNUSED v4-tagged assets are sitting in the library.
// External agents (Higgsfield etc) call GET /api/assets/pool-status with the
// bearer token and refill the combos with deficit > 0; this widget gives the
// owner a glance of which combos are dry.

import { useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCw, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type PoolTarget = {
  layoutPattern: string;
  storeSlug: string;
  unusedCount: number;
  deficit: number;
  targetDepth: number;
};

type PoolStatus = {
  ok: boolean;
  totalUnused: number;
  totalDeficit: number;
  targetDepthPerCombo: number;
  promptVersion: string;
  targets: PoolTarget[];
  totals: { byLayout: Record<string, number>; byStore: Record<string, number> };
};

export function AssetPoolDepth() {
  const [data, setData] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/assets/pool-status");
      const j = (await r.json()) as PoolStatus;
      if (j.ok) setData(j);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  if (!data) {
    return (
      <div className="rounded-md border border-border bg-card/30 p-4 text-[13px] text-muted-foreground">
        {loading ? "Cargando pool depth…" : "No se pudo cargar el pool depth."}
      </div>
    );
  }

  // Group targets by layout so the table reads layout-per-row, store-per-col.
  const layouts = Array.from(new Set(data.targets.map((t) => t.layoutPattern)));
  const stores = Array.from(new Set(data.targets.map((t) => t.storeSlug)));
  const cellByKey = new Map(data.targets.map((t) => [`${t.layoutPattern}::${t.storeSlug}`, t]));

  const exampleCurl = `curl https://sendify.divain.space/api/assets/pool-status \\
  -H "Authorization: Bearer $ASSET_LIBRARY_TOKEN"`;

  return (
    <div className="rounded-md border border-border bg-card/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[14px] font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-foreground/70" /> Pool depth · {data.totalUnused} sin usar · objetivo {data.targetDepthPerCombo}/combo
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {data.totalDeficit > 0
              ? <>Falta llenar <strong className="text-foreground">{data.totalDeficit}</strong> fotos para tener cobertura completa. Conecta Higgsfield al endpoint y se llena solo.</>
              : <>Pool a tope. La generación de emails coge de aquí en vez de llamar a Gemini en runtime.</>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-2 py-1.5 font-medium">Layout</th>
              {stores.map((s) => (
                <th key={s} className="px-2 py-1.5 font-medium text-center">{s.replace("divain-", "")}</th>
              ))}
              <th className="px-2 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {layouts.map((l) => (
              <tr key={l} className="border-t border-border">
                <td className="px-2 py-1.5 font-mono text-[11.5px] text-foreground/80">{l}</td>
                {stores.map((s) => {
                  const cell = cellByKey.get(`${l}::${s}`);
                  if (!cell) return <td key={s} className="px-2 py-1.5" />;
                  const tone = cell.unusedCount === 0
                    ? "bg-[color-mix(in_oklch,var(--danger)_18%,transparent)] text-[color:var(--danger)]"
                    : cell.unusedCount < cell.targetDepth
                      ? "bg-[color-mix(in_oklch,var(--warning)_16%,transparent)] text-[color:var(--warning)]"
                      : "bg-[color-mix(in_oklch,var(--positive)_12%,transparent)] text-[color:var(--positive)]";
                  return (
                    <td key={s} className="px-2 py-1.5 text-center">
                      <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded font-mono tabular-nums ${tone}`}>
                        {cell.unusedCount}/{cell.targetDepth}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right tabular-nums text-foreground/70">
                  {data.totals.byLayout[l] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="rounded-md border border-border bg-card/40 p-3 group">
        <summary className="cursor-pointer text-[13px] font-medium flex items-center justify-between">
          Conectar Higgsfield / agente externo
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-open:rotate-90 transition-transform" />
        </summary>
        <div className="mt-3 space-y-2 text-[12.5px] text-muted-foreground">
          <p>1. El agente hace GET con el bearer token y mira qué combos tienen <code className="text-[11px] bg-muted px-1 rounded">deficit &gt; 0</code>:</p>
          <div className="rounded-md bg-[color:var(--bg)] border border-border p-2.5 flex items-start justify-between gap-2">
            <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-all">{exampleCurl}</pre>
            <button
              onClick={() => { navigator.clipboard.writeText(exampleCurl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
            >
              {copied ? <Check className="h-3 w-3 text-[color:var(--positive)]" /> : <Copy className="h-3 w-3" />}
              {copied ? "copiado" : "copiar"}
            </button>
          </div>
          <p>2. Por cada combo deficitario el agente genera N = deficit imágenes y las sube vía <code className="text-[11px] bg-muted px-1 rounded">POST /api/assets</code> con estos tags:</p>
          <pre className="text-[11.5px] font-mono bg-[color:var(--bg)] border border-border rounded p-2.5 whitespace-pre-wrap">{`tags: [
  "<layoutPattern, ej. lifestyle-hero>",
  "<storeSlug, ej. divain-europa>",
  "${data.promptVersion}",
  "ai-generated",
  "hero"
]`}</pre>
          <p>3. La próxima generación de email coge esa imagen del pool (no llama a Gemini). El asset se marca como usado y deja de aparecer en deficit.</p>
          <p className="text-[12px]">El endpoint <code className="text-[11px] bg-muted px-1 rounded">GET /api/assets/pool-status</code> también devuelve un campo <code className="text-[11px] bg-muted px-1 rounded">contract</code> con un payload ejemplo listo para copy/paste en el agente.</p>
        </div>
      </details>
    </div>
  );
}
