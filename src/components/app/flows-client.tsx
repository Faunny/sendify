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
        <div className="text-[14px] text-muted-foreground">
          {flows.length === 0 ? "Sin flows configurados todavía." : `${flows.filter((f) => f.active).length} activos · ${flows.length} totales`}
        </div>
        <Button size="default" onClick={() => setNewFlowOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo flow
        </Button>
      </div>

      {flows.length === 0 ? (
        <EmptyHero onCreate={() => setNewFlowOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {flows.map((f) => (
            <div
              key={f.id}
              className={`group rounded-md border p-4 transition-colors ${f.active ? "border-foreground/30 bg-foreground/[0.04]" : "border-border bg-card/30"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`grid h-11 w-11 place-items-center rounded-full shrink-0 ${f.active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                  {f.active ? <Power className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
                </div>
                <Link href={`/flows/${f.id}`} className="flex-1 min-w-0">
                  <div className="text-[16px] font-medium truncate">{f.name}</div>
                  <div className="text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                    <span className="uppercase tracking-wider text-foreground/70">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
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
                    size="default"
                    variant={f.active ? "outline" : "default"}
                    onClick={() => toggleActive(f.id, !f.active)}
                  >
                    {f.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    {f.active ? "Pausar" : "Activar"}
                  </Button>
                  <Link href={`/flows/${f.id}`} className="text-muted-foreground hover:text-foreground transition-colors p-2">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => remove(f.id)}
                    className="text-muted-foreground hover:text-[color:var(--danger)] transition-colors p-2"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
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
    <div className="rounded-md border border-border bg-card/40 p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground mb-5">
        <Workflow className="h-6 w-6" />
      </div>
      <div className="text-[18px] font-medium">Sin flows configurados</div>
      <div className="text-[14px] text-muted-foreground mt-2 max-w-lg mx-auto leading-relaxed">
        Crea welcome series, recuperación de carritos abandonados, post-compra o win-back en un click. Una vez activos, se enrolan solos con los webhooks de Shopify que ya están corriendo.
      </div>
      <div className="mt-6">
        <Button size="default" onClick={onCreate}>
          <Plus className="h-4 w-4" /> Crear primer flow
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-[22px]">Nuevo flow</DialogTitle>
          <DialogDescription className="text-[14px]">
            Elige una plantilla pre-construida. Se crea desactivada — la activas cuando estés listo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="max-h-[55vh] overflow-y-auto pr-2 -mr-2 space-y-5">
            {CATEGORY_ORDER.map((cat) => {
              const list = PRESETS_BY_CATEGORY[cat];
              if (list.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-[13px] font-medium uppercase tracking-[2px] text-foreground/80 mb-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                    {CATEGORY_LABEL[cat]} <span className="text-muted-foreground/60 font-normal">· {list.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {list.map((p) => {
                      const Icon = ICON_MAP[p.icon] ?? Workflow;
                      const selected = p.id === presetId;
                      const sendCount = p.graph.steps.filter((s) => s.type === "send").length;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPresetId(p.id)}
                          className={`text-left rounded-md border p-4 transition-colors ${selected ? "border-foreground bg-foreground/[0.06]" : "border-border bg-card/40 hover:bg-secondary/50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${selected ? "text-foreground" : "text-foreground/70"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-medium">{p.name}</div>
                              <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{p.description}</div>
                              <div className="text-[12px] text-muted-foreground/80 mt-2 uppercase tracking-wider">
                                {sendCount} email{sendCount === 1 ? "" : "s"} · {p.estDuration}
                                {p.entryFilter && <span className="text-foreground/90 ml-2">· con filtro</span>}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] font-medium text-foreground/80">Store</span>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="mt-1.5 h-10 text-[14px]"><SelectValue placeholder="elige una store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[14px]">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-foreground/80">Nombre (opcional)</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={preset && stores.find((s) => s.id === storeId) ? `${preset.name} · ${stores.find((s) => s.id === storeId)!.name}` : "Welcome series · Divain Europa"}
                className="mt-1.5 h-10 text-[14px]"
              />
            </label>
          </div>

          {preset && PresetIcon && (
            <div className="rounded-md border border-border bg-card/30 p-4 text-[14px] text-muted-foreground">
              <div className="flex items-center gap-2 mb-3">
                <PresetIcon className="h-4 w-4 text-foreground" />
                <span className="font-medium text-foreground text-[14px]">Pasos del flow</span>
              </div>
              <ol className="space-y-1.5 ml-5 list-decimal text-[13px]">
                {preset.graph.steps.map((s, i) => (
                  <li key={i}>
                    {s.type === "delay" && <>Espera <strong className="text-foreground">{s.hours < 24 ? `${s.hours}h` : `${Math.round(s.hours / 24)}d`}</strong></>}
                    {s.type === "send"  && <>Email · &ldquo;<span className="text-foreground/90">{s.subject}</span>&rdquo;</>}
                    {s.type === "condition" && <em className="text-muted-foreground">Sólo si: {s.label}</em>}
                  </li>
                ))}
              </ol>
              {preset.entryFilter && (
                <div className="mt-3 pt-3 border-t border-border text-[13px]">
                  <span className="text-foreground/80 font-medium">Filtro de entrada · </span>
                  {preset.entryFilter.ordersCountGte !== undefined && <span>ordersCount ≥ {preset.entryFilter.ordersCountGte} </span>}
                  {preset.entryFilter.ordersCountLte !== undefined && <span>ordersCount ≤ {preset.entryFilter.ordersCountLte} </span>}
                  {preset.entryFilter.totalSpentGte !== undefined && <span>totalSpent ≥ {preset.entryFilter.totalSpentGte}€ </span>}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-3 text-[14px] text-[color:var(--danger)]">
              {error}
            </div>
          )}

          <Button onClick={submit} disabled={busy || !storeId || !presetId} size="lg" className="w-full text-[14px]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear flow (desactivado)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
