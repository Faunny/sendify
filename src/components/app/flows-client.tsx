"use client";

import { useState } from "react";
import {
  Workflow, Plus, Heart, ShoppingCart, Sparkles, Clock, Gift, Bell,
  Loader2, Trash2, MoreHorizontal, Power, PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FLOW_PRESETS } from "@/lib/flows/presets";

export type FlowRow = {
  id: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  name: string;
  trigger: string;
  active: boolean;
  enrollmentCount: number;
  sendCount: number;
  lastTriggeredAt: string | null;
  updatedAt: string;
};

export type StoreOption = { id: string; slug: string; name: string };

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart, ShoppingCart, Sparkles, Clock, Bell, Gift,
};

const TRIGGER_LABEL: Record<string, string> = {
  WELCOME: "Customer creado",
  ABANDONED_CART: "Checkout abandonado",
  POST_PURCHASE: "Pedido creado",
  WIN_BACK: "Inactivo 90+ días",
  BROWSE_ABANDONMENT: "Producto visto",
  RESTOCK: "Stock disponible",
  BIRTHDAY: "Cumpleaños",
  CUSTOM: "Manual",
};

export function FlowsClient({ initialFlows, stores }: { initialFlows: FlowRow[]; stores: StoreOption[] }) {
  const [flows, setFlows] = useState<FlowRow[]>(initialFlows);
  const [newFlowOpen, setNewFlowOpen] = useState(false);

  async function toggleActive(id: string, active: boolean) {
    // Optimistic update for snappy UX.
    setFlows((cur) => cur.map((f) => f.id === id ? { ...f, active } : f));
    const r = await fetch(`/api/flows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!r.ok) setFlows((cur) => cur.map((f) => f.id === id ? { ...f, active: !active } : f));
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este flow? Las inscripciones activas se cancelan.")) return;
    const before = flows;
    setFlows((cur) => cur.filter((f) => f.id !== id));
    const r = await fetch(`/api/flows/${id}`, { method: "DELETE" });
    if (!r.ok) setFlows(before);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-muted-foreground">
          {flows.length === 0 ? "Sin flows configurados todavía." : `${flows.filter((f) => f.active).length} activos · ${flows.length} totales`}
        </div>
        <Button size="sm" onClick={() => setNewFlowOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nuevo flow
        </Button>
      </div>

      {flows.length === 0 ? (
        <EmptyHero onCreate={() => setNewFlowOpen(true)} />
      ) : (
        <div className="rounded-md border border-border bg-card/40 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Nombre</th>
                <th className="text-left px-3 py-2 font-medium">Trigger</th>
                <th className="text-left px-3 py-2 font-medium">Store</th>
                <th className="text-right px-3 py-2 font-medium">Inscripciones</th>
                <th className="text-right px-3 py-2 font-medium">Enviados</th>
                <th className="text-center px-3 py-2 font-medium">Activo</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium">{f.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[12px]">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[12px]">{f.storeName}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{f.enrollmentCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{f.sendCount}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch checked={f.active} onCheckedChange={(v) => toggleActive(f.id, v)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => remove(f.id)}
                      className="text-muted-foreground hover:text-[color:var(--danger)] transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewFlowDialog
        open={newFlowOpen}
        onClose={() => setNewFlowOpen(false)}
        stores={stores}
        onCreated={(flow) => setFlows((cur) => [flow, ...cur])}
      />
    </>
  );
}

function EmptyHero({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground mb-4">
        <Workflow className="h-5 w-5" />
      </div>
      <div className="text-[15px] font-medium">Sin flows configurados</div>
      <div className="text-[12px] text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
        Crea welcome series, recuperación de carritos abandonados, post-compra o win-back en un click. Una vez activos, se enrolan solos con los webhooks de Shopify que ya están corriendo.
      </div>
      <div className="mt-5">
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" /> Crear primer flow
        </Button>
      </div>
    </div>
  );
}

function NewFlowDialog({
  open, onClose, stores, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  stores: StoreOption[];
  onCreated: (f: FlowRow) => void;
}) {
  const [presetId, setPresetId] = useState<string>(FLOW_PRESETS[0]?.id ?? "");
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? "");
  const [name, setName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = FLOW_PRESETS.find((p) => p.id === presetId);
  const PresetIcon = preset ? ICON_MAP[preset.icon] : null;

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (!storeId) throw new Error("selecciona una store");
      if (!presetId) throw new Error("selecciona un preset");
      const r = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, presetId, name: name.trim() || undefined }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "create failed");
      const store = stores.find((s) => s.id === storeId)!;
      onCreated({
        id: j.flow.id,
        storeId,
        storeSlug: store.slug,
        storeName: store.name,
        name: j.flow.name,
        trigger: j.flow.trigger,
        active: j.flow.active,
        enrollmentCount: 0,
        sendCount: 0,
        lastTriggeredAt: null,
        updatedAt: j.flow.updatedAt,
      });
      onClose();
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo flow</DialogTitle>
          <DialogDescription>Elige una plantilla pre-construida. Se crea desactivada — la activas cuando estés listo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Plantilla</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FLOW_PRESETS.map((p) => {
                const Icon = ICON_MAP[p.icon] ?? Workflow;
                const selected = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    className={`text-left rounded-md border p-3 transition-colors ${selected ? "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]" : "border-border bg-card/40 hover:bg-secondary/40"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className="h-4 w-4 mt-0.5 text-[color:var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1.5 uppercase tracking-wider">
                          {p.graph.steps.filter((s) => s.type === "send").length} emails · {p.estDuration}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Store</span>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="elige una store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre (opcional)</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={preset && stores.find((s) => s.id === storeId) ? `${preset.name} · ${stores.find((s) => s.id === storeId)!.name}` : "Welcome series · Divain Europa"}
                className="mt-1"
              />
            </label>
          </div>

          {preset && PresetIcon && (
            <div className="rounded-md border border-border bg-card/30 p-3 text-[12px] text-muted-foreground">
              <div className="flex items-center gap-2 mb-1.5">
                <PresetIcon className="h-3.5 w-3.5 text-[color:var(--accent)]" />
                <span className="font-medium text-foreground">Pasos</span>
              </div>
              <ol className="space-y-1 ml-5 list-decimal">
                {preset.graph.steps.map((s, i) => (
                  <li key={i}>
                    {s.type === "delay"
                      ? <>Espera <strong>{s.hours < 24 ? `${s.hours}h` : `${Math.round(s.hours / 24)}d`}</strong></>
                      : <>Email · &ldquo;{s.subject}&rdquo;</>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)]">
              {error}
            </div>
          )}

          <Button onClick={submit} disabled={busy || !storeId || !presetId} className="w-full">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear flow (desactivado)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
