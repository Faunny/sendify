"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Check, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SenderProp = {
  id: string;
  fromEmail: string;
  fromName: string;
  verified: boolean;
  dailyCap: number;
};

type VerifyResult = {
  ok: boolean;
  verified?: boolean;
  dkim?: boolean;
  dkimTokens?: string[];
  mailFromDomain?: string | null;
  mailFromStatus?: string | null;
  sendingEnabled?: boolean | null;
  error?: string;
};

export function SenderConfigDialog({ sender, trigger }: { sender: SenderProp; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const domain = sender.fromEmail.split("@")[1] ?? "";

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch(`/api/senders/${sender.id}/verify`, { method: "POST" });
      const json = await res.json() as VerifyResult;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "network" });
    } finally {
      setBusy(false);
    }
  }

  function copy(s: string) {
    navigator.clipboard.writeText(s).catch(() => {});
  }

  // Standard DNS records template the user pastes into their DNS provider.
  // Real DKIM tokens come from the refresh call.
  const dkimTokens = result?.dkimTokens ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !result) refresh(); }}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sender.fromEmail}
            {result?.verified ? (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[color-mix(in_oklch,var(--positive)_18%,transparent)] text-[color:var(--positive)] flex items-center gap-1"><Check className="h-3 w-3" /> Verified</span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[color-mix(in_oklch,var(--danger)_18%,transparent)] text-[color:var(--danger)]">Unverified</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card/40 p-3 text-[12px]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado SES (en vivo)</div>
              <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Re-verificar
              </Button>
            </div>
            {!result && busy && <div className="text-muted-foreground">Consultando SES…</div>}
            {result && !result.ok && (
              <div className="text-[color:var(--danger)] flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {result.error}</div>
            )}
            {result?.ok && (
              <div className="space-y-1">
                <Row label="Verified for sending" value={result.verified ? "yes" : "no"} ok={!!result.verified} />
                <Row label="DKIM"                 value={result.dkim ? "ok" : "pending"} ok={!!result.dkim} />
                {result.mailFromDomain && <Row label="MAIL FROM" value={`${result.mailFromDomain} (${result.mailFromStatus})`} ok={result.mailFromStatus === "SUCCESS"} />}
              </div>
            )}
          </div>

          <div>
            <div className="text-[12px] font-medium mb-1.5">DNS records para pegar en tu proveedor (Cloudflare / IONOS / Route53)</div>
            <div className="space-y-2 text-[11px] font-mono">
              <DnsRow type="TXT" host={domain} value="v=spf1 include:amazonses.com -all" copy={copy} />
              <DnsRow type="TXT" host={`_dmarc.${domain}`} value="v=DMARC1; p=none; rua=mailto:postmaster@divainparfums.com" copy={copy} />
              {dkimTokens.length === 0 && (
                <div className="text-[11px] text-muted-foreground italic">Los tokens DKIM aparecen cuando le das a Re-verificar (SES los crea al añadir el dominio).</div>
              )}
              {dkimTokens.map((t, i) => (
                <DnsRow key={t} type="CNAME" host={`${t}._domainkey.${domain}`} value={`${t}.dkim.amazonses.com`} copy={copy} index={i + 1} />
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Tras pegarlos en tu DNS, suelen tardar 5-30 min en propagar. Pulsa Re-verificar para que SES los reconozca.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`text-[12px] ${ok ? "text-[color:var(--positive)]" : "text-[color:var(--danger)]"}`}>{value}</span>
    </div>
  );
}

function DnsRow({ type, host, value, copy, index }: { type: string; host: string; value: string; copy: (s: string) => void; index?: number }) {
  return (
    <div className="rounded-md border border-border bg-[color:var(--bg)] p-2 flex items-start gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 w-12">{type}{index ? ` ${index}` : ""}</span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="break-all"><span className="text-muted-foreground">host:</span> {host}</div>
        <div className="break-all"><span className="text-muted-foreground">value:</span> {value}</div>
      </div>
      <button onClick={() => copy(`${host}\t${value}`)} className="text-muted-foreground hover:text-foreground p-1" title="Copiar host + value">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}
