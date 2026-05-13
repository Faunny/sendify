"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, X, Save, Pencil, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Client-side controls for /campaigns/[id]:
//   - Inline edit of subject + preheader
//   - Approve / Reject / Cancel actions
//   - Test send (to admin email — wired to /api/campaigns/[id]/test-send when SES is configured)

export type CampaignActionsProps = {
  campaignId: string;
  initialSubject: string;
  initialPreheader: string;
  status: string;
};

export function CampaignActions({ campaignId, initialSubject, initialPreheader, status }: CampaignActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save() {
    setError(null); setInfo(null);
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, preheader }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "save failed"); return; }
      setEditing(false);
      setInfo("✓ Guardado");
      router.refresh();
    });
  }

  async function approve() {
    setError(null); setInfo(null);
    if (!confirm("¿Aprobar campaña y encolar envíos? Esto traduce, renderiza y enqueua jobs al worker. Sin SES configurado, los Send rows se crearán pero no saldrá email.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/approve`, { method: "POST" });
      const json = await res.json();
      if (!json.ok && res.status !== 202) { setError(json.error ?? "approve failed"); return; }
      setInfo("✓ Campaña aprobada y encolada");
      router.refresh();
    });
  }

  async function cancel() {
    if (!confirm("¿Cancelar? Los emails ya enviados no se pueden recuperar; los pendientes se descartan.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "cancel failed"); return; }
      setInfo("✓ Cancelada");
      router.refresh();
    });
  }

  async function testSend() {
    const email = prompt("¿A qué email mando el test?", "faun@divainparfums.com");
    if (!email) return;
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "test send failed"); return; }
      setInfo(`✓ Test enviado a ${email} · revisa tu inbox en ~10 seg`);
    });
  }

  const canApprove = status === "DRAFT" || status === "PENDING_APPROVAL";
  const canCancel  = status === "SCHEDULED" || status === "SENDING";

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject + preheader</div>
          {!editing ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" /> Editar
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { setSubject(initialSubject); setPreheader(initialPreheader); setEditing(false); }}>Cancelar</Button>
              <Button size="sm" className="h-6 px-2 text-[11px]" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
              </Button>
            </div>
          )}
        </div>
        {editing ? (
          <>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={120} />
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Preheader" maxLength={140} />
          </>
        ) : (
          <>
            <div className="text-[14px] font-medium">{subject}</div>
            <div className="text-[12px] text-muted-foreground">{preheader || <em>sin preheader</em>}</div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={testSend} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Test send
        </Button>
        {canApprove && (
          <Button size="sm" onClick={approve} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve & schedule
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" size="sm" onClick={cancel} disabled={pending} className="text-[color:var(--danger)]">
            <X className="h-3.5 w-3.5" /> Cancel send
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[12px] text-[color:var(--danger)] flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] p-2.5 text-[12px] text-[color:var(--positive)]">
          {info}
        </div>
      )}
    </div>
  );
}
