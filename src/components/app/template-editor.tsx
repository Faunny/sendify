"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Smartphone, Monitor, Send, AlertTriangle, Check, RefreshCw, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PREVIEW_LANGS: Array<{ code: string; label: string; flag: string }> = [
  { code: "es-ES", label: "Español (España)", flag: "🇪🇸" },
  { code: "es-MX", label: "Español (México)", flag: "🇲🇽" },
  { code: "en-GB", label: "English (UK)",     flag: "🇬🇧" },
  { code: "en-US", label: "English (US)",     flag: "🇺🇸" },
  { code: "fr-FR", label: "Français",          flag: "🇫🇷" },
  { code: "de-DE", label: "Deutsch",           flag: "🇩🇪" },
  { code: "it-IT", label: "Italiano",          flag: "🇮🇹" },
  { code: "pt-PT", label: "Português (PT)",    flag: "🇵🇹" },
  { code: "nl-NL", label: "Nederlands",        flag: "🇳🇱" },
  { code: "pl-PL", label: "Polski",            flag: "🇵🇱" },
  { code: "sv-SE", label: "Svenska",           flag: "🇸🇪" },
  { code: "da-DK", label: "Dansk",             flag: "🇩🇰" },
  { code: "fi-FI", label: "Suomi",             flag: "🇫🇮" },
  { code: "no-NO", label: "Norsk",             flag: "🇳🇴" },
  { code: "cs-CZ", label: "Čeština",           flag: "🇨🇿" },
  { code: "ro-RO", label: "Română",            flag: "🇷🇴" },
  { code: "hu-HU", label: "Magyar",            flag: "🇭🇺" },
  { code: "bg-BG", label: "Български",         flag: "🇧🇬" },
  { code: "el-GR", label: "Ελληνικά",          flag: "🇬🇷" },
  { code: "sk-SK", label: "Slovenčina",        flag: "🇸🇰" },
  { code: "sl-SI", label: "Slovenščina",       flag: "🇸🇮" },
];

// Real template editor: MJML source on the left, live compiled preview on
// the right (debounced re-render after each edit), test-send to your inbox
// at the foot. No drag-and-drop builder fantasy — just a functional editor
// that handles 95% of real tweaks (subject swap, copy edit, URL change,
// price change, image replace).

type TemplateProp = {
  id: string;
  name: string;
  mjml: string;
  storeName: string | null;
  storeSlug: string | null;
};

export function TemplateEditor({ template, initialHtml = "" }: { template: TemplateProp; initialHtml?: string }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [mjml, setMjml] = useState(template.mjml);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [html, setHtml] = useState<string>(initialHtml);
  const [rendering, setRendering] = useState(false);
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  // Track whether the MJML has been edited since mount so we don't refire
  // the render API immediately on first paint (we already have initialHtml).
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("divain@divainparfums.com");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; detail: string } | null>(null);

  // Translated previews cache. Keyed by lang code → translated MJML.
  const [previewLang, setPreviewLang] = useState("es-ES");
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  const [translatingLang, setTranslatingLang] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  async function loadTranslation(target: string) {
    if (target === "es-ES") { setPreviewLang("es-ES"); return; }
    if (translationCache[target]) { setPreviewLang(target); return; }
    setTranslatingLang(true);
    setTranslateError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/translate-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml, targetLang: target, sourceLang: "es-ES" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "translation failed");
      setTranslationCache((cur) => ({ ...cur, [target]: json.translatedMjml }));
      setPreviewLang(target);
      // Trigger preview re-render with translated MJML.
      const r2 = await fetch(`/api/templates/${template.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml: json.translatedMjml }),
      });
      const r2j = await r2.json();
      if (r2j.ok) setHtml(r2j.html);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : "translation failed");
    } finally {
      setTranslatingLang(false);
    }
  }

  // Debounced render — 500ms after last keystroke. Skip on first mount when
  // we already have a server-side compiled initialHtml.
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!touched) return;
    if (renderTimer.current) clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(async () => {
      setRendering(true);
      try {
        const res = await fetch(`/api/templates/${template.id}/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mjml }),
        });
        const json = await res.json();
        if (json.ok) {
          setHtml(json.html);
          setRenderErrors(json.errors ?? []);
        } else {
          setRenderErrors([json.error ?? "render failed"]);
        }
      } catch (e) {
        setRenderErrors([e instanceof Error ? e.message : "network"]);
      } finally {
        setRendering(false);
      }
    }, 500);
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current); };
  }, [mjml, template.id, touched]);

  async function save() {
    setSaving(true); setSavedTick(false); setSaveError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mjml }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "save failed");
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testSend() {
    setSendBusy(true); setSendResult(null);
    try {
      // Extract subject + preheader from the MJML if present, else generic.
      const subjectMatch = mjml.match(/<title>([^<]+)<\/title>/);
      const subject = subjectMatch?.[1]?.trim() || name;
      const res = await fetch("/api/templates/test-send-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Edit · ${name}`,
          subject,
          preheader: "",
          mjml,
          storeSlug: template.storeSlug,
          to: testTo.trim(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setSendResult({ ok: false, detail: json.error ?? "send failed" });
      } else {
        setSendResult({ ok: true, detail: `Enviado a ${testTo}` });
      }
    } catch (e) {
      setSendResult({ ok: false, detail: e instanceof Error ? e.message : "network error" });
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="max-w-md text-[14px]" />
        {template.storeName && <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{template.storeName}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {savedTick && <span className="text-[11px] text-[color:var(--positive)] flex items-center gap-1"><Check className="h-3 w-3" /> Guardado</span>}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)] flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{saveError}
        </div>
      )}

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: "72vh" }}>
        {/* Left: MJML source */}
        <div className="rounded-md border border-border bg-card/40 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">MJML source</span>
            <span className="text-[11px] text-muted-foreground">{mjml.length.toLocaleString()} chars</span>
          </div>
          <textarea
            value={mjml}
            onChange={(e) => { setMjml(e.target.value); setTouched(true); }}
            spellCheck={false}
            className="flex-1 p-3 font-mono text-[12px] bg-[color:var(--bg)] text-foreground resize-none focus:outline-none"
            style={{ lineHeight: 1.55, tabSize: 2 }}
          />
          {renderErrors.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-[color-mix(in_oklch,var(--warning)_5%,transparent)] text-[11px] text-[color:var(--warning)]">
              {renderErrors.length} warnings: {renderErrors.slice(0, 3).join(" · ")}
            </div>
          )}
        </div>

        {/* Right: rendered preview */}
        <div className="rounded-md border border-border bg-card/40 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Preview {(rendering || translatingLang) && <RefreshCw className="h-3 w-3 animate-spin" />}
            </span>
            <div className="flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={previewLang}
                onChange={(e) => loadTranslation(e.target.value)}
                disabled={translatingLang}
                className="rounded border border-border bg-card px-2 py-1 text-[12px]"
              >
                {PREVIEW_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}{translationCache[l.code] ? " ✓" : ""}</option>
                ))}
              </select>
              <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")}>
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
              <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")}>
                <Monitor className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {translateError && (
            <div className="px-3 py-1.5 text-[11px] text-[color:var(--danger)] bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] border-b border-[color:var(--danger)]/30 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {translateError}
            </div>
          )}
          <div className="flex-1 overflow-auto p-3 bg-[color:var(--muted)] flex justify-center">
            <div className="bg-white rounded-md shadow" style={{ width: device === "desktop" ? 620 : 380, maxWidth: "100%" }}>
              <iframe
                srcDoc={html || "<div style=\"padding:24px;color:#666\">Renderizando…</div>"}
                className="w-full"
                style={{ minHeight: "65vh", border: 0 }}
                title="preview"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Test send */}
      <div className="rounded-md border border-border bg-card/40 p-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Probar envío</span>
        <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="text-[13px] flex-1 min-w-[220px] max-w-md" placeholder="tu@email.com" />
        <Button size="sm" onClick={testSend} disabled={sendBusy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testTo.trim())}>
          {sendBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Enviar test
        </Button>
        {sendResult && (
          <span className={`text-[12px] ${sendResult.ok ? "text-[color:var(--positive)]" : "text-[color:var(--danger)]"}`}>
            {sendResult.ok ? "✓" : "✗"} {sendResult.detail}
          </span>
        )}
      </div>
    </div>
  );
}
