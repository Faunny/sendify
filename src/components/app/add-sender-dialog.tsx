"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AddSenderDialog({ stores }: { stores: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName]   = useState("");
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "");
  const [dailyCap, setDailyCap]   = useState(1000);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const [ok, setOk]     = useState<{ dkimTokens: string[] } | null>(null);

  async function create() {
    setBusy(true); setErr(null); setOk(null);
    try {
      const res = await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail, fromName, storeSlug, dailyCap }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "create failed");
      setOk({ dkimTokens: json.dkimTokens ?? [] });
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
        <Plus className="h-3.5 w-3.5" /> Add sender
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir sender</DialogTitle>
          </DialogHeader>

          {ok ? (
            <div className="space-y-3">
              <div className="rounded-md border border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] p-3 text-[13px] text-[color:var(--positive)] flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Sender creado. SES ha registrado el dominio.{ok.dkimTokens.length > 0 ? ` Se generaron ${ok.dkimTokens.length} DKIM tokens.` : ""} Abre el card del sender → "Configure" → ahí están los DNS records que tienes que pegar en tu proveedor.
                </div>
              </div>
              <Button onClick={() => { setOpen(false); setOk(null); }} className="w-full">Hecho</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">From email</span>
                <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="divain@divainparfums.com" className="mt-1" autoFocus />
              </label>
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">From name</span>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="divain" className="mt-1" />
              </label>
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Tienda</span>
                <select value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px]">
                  {stores.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Daily cap</span>
                <Input type="number" value={dailyCap} onChange={(e) => setDailyCap(parseInt(e.target.value, 10) || 0)} className="mt-1" />
              </label>

              {err && (
                <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[13px] text-[color:var(--danger)] flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{err}
                </div>
              )}

              <Button onClick={create} disabled={busy || !fromEmail || !fromName || !storeSlug} className="w-full">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Crear sender + iniciar verificación SES
              </Button>
              <div className="text-[11px] text-muted-foreground">
                Sendify pide a SES que registre el dominio del email. Tras crearlo, abres el sender y pegas los DNS records en tu proveedor (Cloudflare/IONOS/Route53).
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
