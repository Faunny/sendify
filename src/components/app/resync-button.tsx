"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Progress = {
  fetched?: number;
  upserted?: number;
  failed?: number;
  firstError?: string;
  finishedAt?: number;
  productsFetched?: number;
};

// Re-sync products + customers for a chosen store. Same auto-resume loop as
// the credential card's "Sync now" button — keeps POSTing until hasMore is
// false on both customers and products.
export function ResyncButton({ stores }: { stores: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "");
  const [what, setWhat] = useState<"both" | "customers" | "products">("both");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ customers?: Progress; products?: Progress } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true); setError(null); setProgress({});
    let transient = 0;
    try {
      while (true) {
        const res = await fetch("/api/shopify/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeSlug, what }),
        });
        const raw = await res.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let json: any = null;
        try { json = JSON.parse(raw); } catch { /* not JSON */ }
        if (!json) {
          if (res.status >= 500 && transient < 3) {
            transient++;
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error(`server returned non-JSON (${res.status}): ${raw.slice(0, 160)}`);
        }
        if (!json.ok) throw new Error(json.error ?? "sync failed");
        transient = 0;
        setProgress({ customers: json.customers, products: json.products });
        const cMore = json.customers?.hasMore;
        const pMore = json.products?.hasMore;
        if (!cMore && !pMore) break;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-3.5 w-3.5" /> Re-sync
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-sync desde Shopify</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Tienda</span>
              <select value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} disabled={busy} className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Qué sincronizar</span>
              <select value={what} onChange={(e) => setWhat(e.target.value as typeof what)} disabled={busy} className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                <option value="both">Clientes + Productos</option>
                <option value="customers">Solo clientes</option>
                <option value="products">Solo productos</option>
              </select>
            </label>

            {progress && (
              <div className="grid grid-cols-2 gap-2">
                <ProgressTile label="Customers" fetched={progress.customers?.fetched ?? 0} upserted={progress.customers?.upserted ?? 0} failed={progress.customers?.failed ?? 0} done={!!progress.customers?.finishedAt} firstError={progress.customers?.firstError} />
                <ProgressTile label="Products"  fetched={progress.products?.productsFetched ?? 0} upserted={progress.products?.upserted ?? 0} failed={progress.products?.failed ?? 0} done={!!progress.products?.finishedAt} firstError={progress.products?.firstError} />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[13px] text-[color:var(--danger)] flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="text-[12px] text-muted-foreground">
                {busy ? "Sincronizando… (auto-loop hasta terminar)" : "Cada round sincroniza ~40s antes de relanzar"}
              </div>
              <Button onClick={start} disabled={busy || !storeSlug}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {busy ? "En curso…" : "Empezar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProgressTile({ label, fetched, upserted, failed, done, firstError }: { label: string; fetched: number; upserted: number; failed: number; done: boolean; firstError?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground uppercase tracking-wider text-[11px]">{label}</span>
        {done && <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" />}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-medium tabular-nums">{upserted.toLocaleString()}</span>
        <span className="text-muted-foreground text-[11px]">de {fetched.toLocaleString()} fetched</span>
      </div>
      {failed > 0 && (
        <div className="mt-1 text-[11px] text-[color:var(--danger)]">{failed.toLocaleString()} failed</div>
      )}
      {firstError && (
        <div className="mt-1 text-[10px] text-[color:var(--danger)] break-all opacity-90">{firstError.slice(0, 140)}</div>
      )}
    </div>
  );
}
