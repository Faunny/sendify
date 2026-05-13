"use client";

import { useEffect, useState } from "react";
import { Check, Download, Eye, EyeOff, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Editable credential card. Renders for each provider in Settings → Integrations.
// Tracks four states: empty (no value saved) · saved (masked, ✓) · testing · failed.
// "Save" hits POST /api/credentials, "Test" hits POST /api/credentials/test, "Remove"
// hits DELETE /api/credentials.

export type CredentialCardProps = {
  provider: string;
  scope?: string | null;
  title: string;
  hint: string;
  detail?: string;
  helpUrl?: string;
  helpUrlLabel?: string;
  initialValue?: string;       // masked from server: "sk_••••_abc1"
  initialLabel?: string;
  initialTestOk?: boolean | null;
  initialTestedAt?: string | null;
  metaFields?: { name: string; placeholder?: string; defaultValue?: string }[];
};

export function CredentialCard(props: CredentialCardProps) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState(props.initialLabel ?? "");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail?: string; latencyMs?: number } | null>(null);
  const [hasValue, setHasValue] = useState(!!props.initialValue);

  // Settings is a client page that doesn't pre-fetch from the DB, so on every
  // mount we have to ask the API whether this credential is already stored.
  // Single lightweight call to /api/credentials/status — never returns the value.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ provider: props.provider });
    if (props.scope) params.set("scope", props.scope);
    fetch(`/api/credentials/status?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        if (j.exists) setHasValue(true);
        if (typeof j.lastTestOk === "boolean") {
          setTestResult({ ok: j.lastTestOk, detail: j.lastTestError ?? undefined });
        }
      })
      .catch(() => { /* offline: leave state as-is */ });
    return () => { cancelled = true; };
  }, [props.provider, props.scope]);

  // Shopify-specific: once a token is saved, the card also offers a "Sync now" button
  // that triggers an initial bulk pull of customers + products for that store. Progress
  // polled from /api/shopify/sync/status. Only the Client ID card carries the sync UI —
  // the Client secret card (scope ":secret") is a passive value used for HMAC + OAuth.
  const isShopify = props.provider === "SHOPIFY" && !!props.scope && !props.scope.endsWith(":secret");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    customers?: { fetched: number; upserted: number; failed?: number; firstError?: string; finishedAt?: number };
    products?:  { productsFetched: number; upserted: number; failed?: number; firstError?: string; finishedAt?: number };
  } | null>(null);

  // The sync endpoint runs SYNCHRONOUSLY now and returns final progress + a
  // `hasMore` flag. Keep calling until hasMore goes false (auto-resume across
  // 45 s budget windows).
  async function startSync() {
    if (!isShopify) return;
    setSyncing(true);
    setSyncProgress({});
    setTestResult(null);
    try {
      while (true) {
        const res = await fetch("/api/shopify/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeSlug: props.scope, what: "both" }),
        });
        const json = await res.json();
        if (!json.ok) {
          throw new Error(json.error ?? "sync failed");
        }
        setSyncProgress({ customers: json.customers, products: json.products });
        const customersMore = json.customers?.hasMore;
        const productsMore  = json.products?.hasMore;
        if (!customersMore && !productsMore) break;
      }
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  async function save() {
    if (!value || value.length < 4) return;
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: props.provider, scope: props.scope ?? null, value, label }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "save failed");
      setHasValue(true);
      setValue("");
      setShow(false);
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "save failed" });
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
        body: JSON.stringify({ provider: props.provider, scope: props.scope ?? null }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "test failed" });
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar credencial de ${props.title}? Las features que dependen de ella dejarán de funcionar.`)) return;
    setRemoving(true);
    try {
      const url = new URL("/api/credentials", window.location.origin);
      url.searchParams.set("provider", props.provider);
      if (props.scope) url.searchParams.set("scope", props.scope);
      const res = await fetch(url.toString(), { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "delete failed");
      setHasValue(false);
      setTestResult(null);
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "delete failed" });
    } finally {
      setRemoving(false);
    }
  }

  const lastTestStatus = testResult ?? (props.initialTestOk != null ? { ok: props.initialTestOk } : null);

  return (
    <div className="rounded-md border border-border bg-card/40 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-medium">{props.title}</h3>
            {hasValue ? (
              lastTestStatus ? (
                lastTestStatus.ok ? <Badge variant="positive"><Check className="h-2.5 w-2.5" /> Conectado</Badge>
                                  : <Badge variant="danger"><X className="h-2.5 w-2.5" /> Fallo</Badge>
              ) : (
                <Badge variant="muted">Guardado · sin test</Badge>
              )
            ) : (
              <Badge variant="warning">No configurado</Badge>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5">{props.hint}</p>
          {props.detail && <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{props.detail}</p>}
          {props.helpUrl && (
            <a href={props.helpUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[color:var(--accent)] hover:underline mt-1.5 inline-block">
              {props.helpUrlLabel ?? "Cómo conseguir la API key →"}
            </a>
          )}
        </div>
        {hasValue && (
          <Button variant="ghost" size="icon-sm" onClick={remove} disabled={removing} title="Eliminar credencial">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-[color:var(--danger)]" />}
          </Button>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={hasValue ? "•••••••••••• (pega un nuevo valor para reemplazar)" : "Pega aquí la API key"}
            className="font-mono pr-9"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShow((x) => !x)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button onClick={save} disabled={saving || !value || value.length < 4} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
        </Button>
        {hasValue && (
          <Button variant="outline" size="sm" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Probar"}
          </Button>
        )}
      </div>

      {testResult && !testResult.ok && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)]">
          {testResult.detail ?? "Test fallido"}
        </div>
      )}
      {testResult && testResult.ok && (
        <div className="text-[12px] text-[color:var(--positive)]">
          ✓ Conexión verificada{testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ""}
        </div>
      )}

      {isShopify && hasValue && (
        <div className="border-t border-border pt-3 mt-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="text-[13px] font-medium">Sync inicial</div>
              <div className="text-[11px] text-muted-foreground">Importa customers (con historial de compras) + productos · ~5min para 100k clientes</div>
            </div>
            <Button onClick={startSync} disabled={syncing} size="sm" variant={syncing ? "outline" : "default"}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {syncing ? "Sincronizando…" : "Sync now"}
            </Button>
          </div>
          {syncProgress && (
            <>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <SyncTile label="Customers" fetched={syncProgress.customers?.fetched ?? 0} upserted={syncProgress.customers?.upserted ?? 0} failed={syncProgress.customers?.failed ?? 0} done={!!syncProgress.customers?.finishedAt} />
                <SyncTile label="Products"  fetched={syncProgress.products?.productsFetched ?? 0} upserted={syncProgress.products?.upserted ?? 0} failed={syncProgress.products?.failed ?? 0} done={!!syncProgress.products?.finishedAt} />
              </div>
              {(syncProgress.customers?.firstError || syncProgress.products?.firstError) && (
                <div className="mt-2 rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[11px] text-[color:var(--danger)] break-all">
                  {syncProgress.customers?.firstError ?? syncProgress.products?.firstError}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SyncTile({ label, fetched, upserted, failed, done }: { label: string; fetched: number; upserted: number; failed: number; done: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground uppercase tracking-wider text-[11px]">{label}</span>
        {done && <Check className="h-3 w-3 text-[color:var(--positive)]" />}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-medium tabular-nums">{upserted.toLocaleString()}</span>
        <span className="text-muted-foreground text-[11px]">de {fetched.toLocaleString()} fetched</span>
      </div>
      {failed > 0 && (
        <div className="mt-0.5 text-[11px] text-[color:var(--danger)]">
          {failed.toLocaleString()} failed
        </div>
      )}
    </div>
  );
}
