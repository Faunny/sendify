"use client";

import { useState } from "react";
import {
  Power, PowerOff, Mail, Clock, GitBranch, Loader2, Trash2,
  Mailbox, Send as SendIcon, Eye, MousePointerClick, AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { FlowGraph, FlowStep } from "@/lib/flows/presets";

export type FlowDetail = {
  id: string;
  name: string;
  active: boolean;
  trigger: string;
  storeName: string;
  graph: FlowGraph;
  stats: {
    enrolledTotal: number;
    sendsTotal: number;
    sentSucceeded: number;
    sentDelivered: number;
    sentOpened: number;
    sentClicked: number;
    sentFailed: number;
    enrolledActive: number;
    enrolledCompleted: number;
    enrolledCancelled: number;
    enrolledFailed: number;
  };
};

export function FlowDetailClient({ flow }: { flow: FlowDetail }) {
  const router = useRouter();
  const [active, setActive] = useState(flow.active);
  const [steps, setSteps] = useState<FlowStep[]>(flow.graph.steps);
  const [toggling, setToggling] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleFlowActive() {
    setBusy(true);
    const next = !active;
    setActive(next); // optimistic
    const r = await fetch(`/api/flows/${flow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    if (!r.ok) setActive(!next);
    setBusy(false);
  }

  async function toggleStep(index: number, enabled: boolean) {
    setToggling(index);
    // optimistic
    setSteps((cur) => cur.map((s, i) => i === index ? { ...s, enabled } : s));
    const r = await fetch(`/api/flows/${flow.id}/step`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: index, enabled }),
    });
    if (!r.ok) setSteps((cur) => cur.map((s, i) => i === index ? { ...s, enabled: !enabled } : s));
    setToggling(null);
  }

  async function deleteFlow() {
    if (!confirm("¿Eliminar este flow? Las inscripciones activas se cancelan.")) return;
    setBusy(true);
    const r = await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
    if (r.ok) router.push("/flows");
    else setBusy(false);
  }

  const openRate    = flow.stats.sendsTotal ? Math.round((flow.stats.sentOpened / flow.stats.sendsTotal) * 100) : 0;
  const clickRate   = flow.stats.sendsTotal ? Math.round((flow.stats.sentClicked / flow.stats.sendsTotal) * 100) : 0;
  const disabledStepCount = steps.filter((s) => s.enabled === false).length;

  return (
    <>
      {/* Master on/off */}
      <div className={`rounded-md border p-5 flex items-center justify-between gap-4 ${active ? "border-foreground/40 bg-foreground/[0.05]" : "border-border bg-card/40"}`}>
        <div className="flex items-center gap-4">
          <div className={`grid h-12 w-12 place-items-center rounded-full ${active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
            {active ? <Power className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-[17px] font-medium">{active ? "Flow activo" : "Flow pausado"}</div>
            <div className="text-[14px] text-muted-foreground mt-1">
              {active
                ? "Los webhooks de Shopify están enrolando clientes en este momento."
                : "Los webhooks llegan pero no enrolan a nadie. Reactiva cuando quieras."}
              {disabledStepCount > 0 && active && (
                <span className="ml-1.5 text-[color:var(--warning)]">· {disabledStepCount} paso{disabledStepCount === 1 ? "" : "s"} desactivado{disabledStepCount === 1 ? "" : "s"}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="default"
            variant={active ? "outline" : "default"}
            onClick={toggleFlowActive}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            {active ? "Pausar" : "Activar"}
          </Button>
          <Button size="default" variant="outline" onClick={deleteFlow} disabled={busy} className="text-[color:var(--danger)] hover:text-[color:var(--danger)]">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={<Mailbox className="h-4 w-4" />} label="Inscritos" value={flow.stats.enrolledTotal} sub={`${flow.stats.enrolledActive} activos`} />
        <MetricCard icon={<SendIcon className="h-4 w-4" />} label="Enviados" value={flow.stats.sendsTotal} sub={`${flow.stats.sentFailed} fallidos`} subDanger={flow.stats.sentFailed > 0} />
        <MetricCard icon={<Eye className="h-4 w-4" />} label="Aperturas" value={`${openRate}%`} sub={`${flow.stats.sentOpened} totales`} />
        <MetricCard icon={<MousePointerClick className="h-4 w-4" />} label="Clicks" value={`${clickRate}%`} sub={`${flow.stats.sentClicked} totales`} />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="text-[14px] font-medium uppercase tracking-[2px] text-foreground/80">Pasos del flow</div>
        {steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            index={i}
            toggling={toggling === i}
            onToggle={(enabled) => toggleStep(i, enabled)}
          />
        ))}
      </div>
    </>
  );
}

function MetricCard({
  icon, label, value, sub, subDanger,
}: { icon: React.ReactNode; label: string; value: string | number; sub?: string; subDanger?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <div className="flex items-center gap-1.5 text-[13px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-[30px] font-light tabular-nums mt-1.5">{value}</div>
      {sub && (
        <div className={`text-[13px] mt-1 ${subDanger ? "text-[color:var(--danger)]" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step, index, toggling, onToggle,
}: {
  step: FlowStep;
  index: number;
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const enabled = step.enabled !== false;

  if (step.type === "delay") {
    return (
      <div className={`rounded-md border p-4 flex items-center gap-4 ${enabled ? "border-border bg-card/30" : "border-border bg-card/10 opacity-60"}`}>
        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <div className="text-[15px] font-medium">
            Esperar {step.hours < 24 ? `${step.hours} hora${step.hours === 1 ? "" : "s"}` : `${Math.round(step.hours / 24)} día${step.hours / 24 === 1 ? "" : "s"}`}
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5">Paso #{index + 1} · delay</div>
        </div>
        {/* Delays are always on — disabling a delay would skip the wait, which is rarely what you want. */}
        <span className="text-[12px] uppercase tracking-wider text-muted-foreground/70">siempre activo</span>
      </div>
    );
  }

  if (step.type === "condition") {
    return (
      <div className={`rounded-md border p-4 flex items-center gap-4 ${enabled ? "border-border bg-card/30" : "border-border bg-card/10 opacity-60"}`}>
        <GitBranch className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <div className="text-[15px] font-medium">Sólo si: {step.label}</div>
          <div className="text-[13px] text-muted-foreground mt-0.5">
            Paso #{index + 1} · condition · <code className="text-[12px] bg-secondary/60 px-1.5 py-0.5 rounded">{step.field} {step.op} {String(step.value)}</code>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-medium uppercase tracking-wider text-foreground/80">{enabled ? "ON" : "OFF"}</span>
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={toggling} />
        </div>
      </div>
    );
  }

  // type === "send"
  return (
    <div className={`rounded-md border p-4 flex items-start gap-4 ${enabled ? "border-border bg-card/30" : "border-border bg-card/10 opacity-60"}`}>
      <Mail className={`h-5 w-5 shrink-0 mt-0.5 ${enabled ? "text-foreground" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium truncate">{step.subject}</div>
        <div className="text-[13px] text-muted-foreground truncate mt-0.5">{step.preheader}</div>
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground/80 mt-1.5">Paso #{index + 1} · email</div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[12px] font-medium uppercase tracking-wider text-foreground/80">{enabled ? "ON" : "OFF"}</span>
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={toggling} />
      </div>
    </div>
  );
}
