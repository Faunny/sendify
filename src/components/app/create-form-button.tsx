"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CreateFormButton({ stores }: { stores: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"EMBED" | "POPUP" | "INLINE" | "HOSTED">("EMBED");
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Nuevo formulario", kind, storeSlug }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "create failed");
      setOpen(false);
      router.push(`/forms/${json.form.slug}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Nuevo formulario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear formulario</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre interno</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Newsletter homepage" autoFocus className="mt-1" />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px]">
                <option value="EMBED">Embed (inline en cualquier página)</option>
                <option value="POPUP">Popup (exit-intent / delay)</option>
                <option value="INLINE">Inline permanente</option>
                <option value="HOSTED">Página hospedada por Sendify</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Tienda destino</span>
              <select value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px]">
                <option value="">(Sin tienda — global)</option>
                {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </label>

            {err && (
              <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)] flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{err}
              </div>
            )}

            <Button onClick={create} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Crear y configurar →
            </Button>
            <div className="text-[11px] text-muted-foreground">
              Por defecto: campo Email + checkbox de consent + CTA &quot;Suscribirme&quot;. Editas todo en la siguiente pantalla.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
