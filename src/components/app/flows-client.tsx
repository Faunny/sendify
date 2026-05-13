"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Workflow, Plus, Heart, ShoppingCart, Sparkles, Clock, Gift, Bell,
  Eye, Star, RotateCcw, TrendingDown, PartyPopper, ShoppingBag, Mail,
  Award, Repeat, MoonStar, Loader2, Trash2, Power, PowerOff, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FLOW_PRESETS, PRESETS_BY_CATEGORY, type FlowPresetCategory } from "@/lib/flows/presets";

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
  Heart, ShoppingCart, Sparkles, Clock, Bell, Gift, Eye, Star, RotateCcw,
  TrendingDown, PartyPopper, ShoppingBag, Mail, Award, Repeat, MoonStar,
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

const CATEGORY_ORDER: FlowPresetCategory[] = ["Acquisition", "Cart", "Retention", "Win-back", "Lifecycle"];
const CATEGORY_LABEL: Record<FlowPresetCategory, string> = {
  "Acquisition": "Captación",
  "Cart":        "Carrito",
  "Retention":   "Retención",
  "Win-back":    "Reactivación",
  "Lifecycle":   "Ciclo de vida",
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
        <div className="grid grid-cols-1 gap-2">
          {flows.map((f) => (
            <div
              key={f.id}
              className={`group rounded-md border p-3 transition-colors ${f.active ? "border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)]" : "border-border bg-card/30"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-9 w-9 place-items-center rounded-full shrink-0 ${f.active ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)]" : "bg-secondary text-muted-foreground"}`}>
                  {f.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </div>
                <Link href={`/flows/${f.id}`} className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="uppercase tracking-wider">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                    <span>·</span>
                    <span>{f.storeName}</span>
                    <span>·</span>
                    <span className="tabular-nums">{f.enrollmentCount} inscritos</span>
                    <span>·</span>
                    <span className="tabular-nums">{f.sendCount} enviados</span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={f.active ? "outline" : "default"}
                    onClick={() => toggleActive(f.id, !f.active)}
                  >
                    {f.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    {f.active ? "Pausar" : "Activar"}
                  </Button>
                  <Link href={`/flows/${f.id}`} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => remove(f.id)}
                    className="text-muted-foreground hover:text-[color:var(--danger)] transition-colors p-1.5"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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

      let r: Response;
      try {
        r = await fetch("/api/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, presetId, name: name.trim() || undefined }),
        });
      } catch (netErr) {
        // Native fetch threw — server unreachable / function crashed / deploy still
        // in progress. Make the error actionable instead of just "Failed to fetch".
        throw new Error(`Servidor no responde (${netErr instanceof Error ? netErr.message : "network"}) — espera a que termine el deploy y reintenta.`);
      }

      // Try to parse as JSON, but fall back to text if the server returned HTML
      // (e.g. Vercel's 504 timeout page).
      const text = await r.text();
      let j: { ok?: boolean; error?: string; flow?: { id: string; name: string; trigger: string; active: boolean; updatedAt: string } } = {};
      try { j = JSON.parse(text); } catch {
        throw new Error(`Respuesta no JSON (HTTP ${r.status}): ${text.slice(0, 160)}`);
      }
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (!j.flow) throw new Error("respuesta sin flow");

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
          <div className="max-h-[60vh] overflow-y-auto pr-1 -mr-1 space-y-4">
            {CATEGORY_ORDER.map((cat) => {
              const list = PRESETS_BY_CATEGORY[cat];
              if (list.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-[10px] uppercase tracking-[2.5px] text-muted-foreground/80 mb-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                    {CATEGORY_LABEL[cat]} <span className="text-muted-foreground/40">· {list.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {list.map((p) => {
                      const Icon = ICON_MAP[p.icon] ?? Workflow;
                      const selected = p.id === presetId;
                      const sendCount = p.graph.steps.filter((s) => s.type === "send").length;
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
                                {sendCount} email{sendCount === 1 ? "" : "s"} · {p.estDuration}
                                {p.entryFilter && <span className="text-[color:var(--accent)] ml-1.5">· con filtro</span>}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                    {s.type === "delay" && <>Espera <strong>{s.hours < 24 ? `${s.hours}h` : `${Math.round(s.hours / 24)}d`}</strong></>}
                    {s.type === "send"  && <>Email · &ldquo;{s.subject}&rdquo;</>}
                    {s.type === "condition" && <em className="text-muted-foreground">Sólo si: {s.label}</em>}
                  </li>
                ))}
              </ol>
              {preset.entryFilter && (
                <div className="mt-2.5 pt-2.5 border-t border-border text-[11px]">
                  <span className="text-muted-foreground">Filtro de entrada · </span>
                  {preset.entryFilter.ordersCountGte !== undefined && <span>ordersCount ≥ {preset.entryFilter.ordersCountGte} </span>}
                  {preset.entryFilter.ordersCountLte !== undefined && <span>ordersCount ≤ {preset.entryFilter.ordersCountLte} </span>}
                  {preset.entryFilter.totalSpentGte !== undefined && <span>totalSpent ≥ {preset.entryFilter.totalSpentGte}€ </span>}
                </div>
              )}
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
