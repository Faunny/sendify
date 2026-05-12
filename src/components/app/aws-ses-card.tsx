"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Three-field credential card specifically for AWS SES — Access Key ID is the
// primary value; Secret Access Key and Region live in `meta`. Stored in the same
// encrypted ProviderCredential row at provider=AWS_SES.

const SES_REGIONS = [
  "eu-west-1", "eu-west-2", "eu-central-1", "eu-north-1", "eu-south-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
];

export function AwsSesCard() {
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [region, setRegion] = useState("eu-north-1");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/credentials/status?provider=AWS_SES`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        setHasValue(!!j.exists);
        if (j.lastTestOk != null) setResult({ ok: j.lastTestOk, detail: j.lastTestError ?? undefined });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!accessKeyId || accessKeyId.length < 16 || !secret || secret.length < 30) {
      setResult({ ok: false, detail: "Access Key ID o Secret demasiado cortos" });
      return;
    }
    setSaving(true); setResult(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "AWS_SES",
          value: accessKeyId,
          label: `IAM user · ${region}`,
          meta: { secret, region },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "save failed");
      setHasValue(true);
      setAccessKeyId("");
      setSecret("");
      setResult({ ok: true, detail: "Guardado · pulsa Probar para verificar" });
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "AWS_SES" }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "test failed" });
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar credenciales SES? Sendify dejará de poder enviar emails.")) return;
    setRemoving(true);
    try {
      const url = new URL("/api/credentials", window.location.origin);
      url.searchParams.set("provider", "AWS_SES");
      const res = await fetch(url.toString(), { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "delete failed");
      setHasValue(false);
      setResult(null);
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "delete failed" });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[12px] font-medium">Amazon SES</div>
            {hasValue
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_oklch,var(--positive)_15%,transparent)] text-[color:var(--positive)]">Guardado{result?.ok ? " · ✓" : result?.ok === false ? " · ✗" : " · sin test"}</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_oklch,var(--accent)_15%,transparent)] text-[color:var(--accent)]">No configurado</span>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">IAM user con SES SendEmail. 14 emails/sec aprobado · fuera de sandbox.</div>
        </div>
        {hasValue && (
          <Button variant="ghost" size="icon-sm" onClick={remove} disabled={removing} className="text-[color:var(--danger)]">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Access Key ID</span>
          <Input
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder={hasValue ? "•••••••••••••••• (pega para reemplazar)" : "AKIA…"}
            className="mt-1 font-mono text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Secret Access Key</span>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={hasValue ? "•••••••••••••••• (pega para reemplazar)" : "40 caracteres"}
              className="mt-1 font-mono text-[12px] pr-9"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Region</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-mono"
          >
            {SES_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !accessKeyId || !secret} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
        </Button>
        {hasValue && (
          <Button variant="outline" size="sm" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Probar
          </Button>
        )}
      </div>

      {result && (
        <div className={`rounded-md border p-2 text-[11px] flex items-start gap-2 ${result.ok ? "border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] text-[color:var(--positive)]" : "border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] text-[color:var(--danger)]"}`}>
          {!result.ok && <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />}
          <span className="break-all">{result.detail ?? (result.ok ? "OK" : "fallo")}</span>
        </div>
      )}
    </div>
  );
}
