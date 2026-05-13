"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One-click "promo → AI → SES → inbox" trigger. Sits on /calendar so the user
// can pick any active Promotion row and receive the fully-rendered email in
// their inbox without leaving the page.

type Promo = {
  id: string;
  name: string;
  storeSlug: string | null;
  storeName: string | null;
  nextDate: string | null;
};

type SendResult = {
  ok: boolean;
  stage?: string;
  subject?: string;
  layoutPattern?: string;
  modelUsed?: string;
  bannerUrl?: string;
  bannerError?: string;
  templateId?: string;
  messageId?: string;
  error?: string;
};

export function TestSendPromo({ promos, defaultEmail }: { promos: Promo[]; defaultEmail?: string }) {
  const [promoId, setPromoId] = useState(promos[0]?.id ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const selectedPromo = promos.find((p) => p.id === promoId);

  async function send() {
    if (!promoId || !validEmail) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch(`/api/promotions/${promoId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          storeSlug: selectedPromo?.storeSlug ?? undefined,
        }),
      });
      const json = await res.json() as SendResult;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-[color:var(--accent)] shrink-0 mt-0.5" />
        <div>
          <div className="text-[14px] font-medium">Generar email + enviar test a tu inbox</div>
          <div className="text-[12px] text-muted-foreground">
            Elige una promoción → la IA escribe copy + genera foto editorial con tu botella real → SES te lo manda. ~60s.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
        <select
          value={promoId}
          onChange={(e) => setPromoId(e.target.value)}
          disabled={busy}
          className="rounded-md border border-border bg-card px-2.5 py-2 text-[13px]"
        >
          {promos.length === 0 && <option>Sin promociones activas</option>}
          {promos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.storeName ? ` · ${p.storeName}` : ""}{p.nextDate ? ` · ${p.nextDate}` : ""}
            </option>
          ))}
        </select>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          disabled={busy}
          className="text-[13px]"
        />
        <Button onClick={send} disabled={busy || !validEmail || !promoId}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Generar y enviar
        </Button>
      </div>

      {busy && (
        <div className="text-[12px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generando copy con GPT, foto editorial con tu botella real, renderizando MJML y enviando vía SES…
        </div>
      )}

      {result && (
        <div className={`rounded-md border p-3 text-[12px] ${
          result.ok
            ? "border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] text-[color:var(--positive)]"
            : "border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] text-[color:var(--danger)]"
        }`}>
          {result.ok ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5" /> Enviado a {email}
              </div>
              <div className="text-foreground text-[11px] space-y-0.5 pt-1">
                <div>Subject: <strong>{result.subject}</strong></div>
                <div>Pattern: {result.layoutPattern} · {result.modelUsed}</div>
                {result.bannerUrl && <div>Hero: <a href={result.bannerUrl} target="_blank" className="underline break-all text-[color:var(--accent)]">{result.bannerUrl}</a></div>}
                {result.bannerError && <div className="text-[color:var(--danger)]">Banner: {result.bannerError}</div>}
                {result.templateId && <div className="opacity-75">Template id: <code>{result.templateId}</code></div>}
              </div>
              <div className="text-[11px] pt-1.5 flex items-center gap-1">
                Revisa tu inbox (puede tardar 10-30s en aparecer) <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Falló en {result.stage ?? "?"}</div>
                <div className="opacity-90 break-all">{result.error}</div>
                {result.templateId && <div className="text-[11px] opacity-80 mt-1">Template guardado igualmente: <code>{result.templateId}</code></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
