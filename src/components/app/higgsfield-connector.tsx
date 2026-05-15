"use client";

// Higgsfield connector — Higgsfield has no public REST API, so the integration
// is a "human-in-the-loop bridge": you generate images in Higgsfield, then
// either (a) paste the image URLs here or (b) drag the downloaded files, and
// Sendify ingests them into the asset pool with the right tags so the email
// generator picks them up.
//
// Saves a Higgsfield "session label" (account email + nickname) via the
// existing CredentialCard infra. The label is for memory only — there's
// nothing API to hit. The real value is the bulk-import below.

import { useState } from "react";
import { Loader2, Upload, Link as LinkIcon, Check, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CredentialCard } from "@/components/app/credential-card";
import { LAYOUT_LIBRARY } from "@/lib/ai/template-patterns";

const PROMPT_VERSION = "v4-with-product";

type Store = { slug: string; name: string };

export function HiggsfieldConnector({ stores }: { stores: Store[] }) {
  const [layout, setLayout] = useState(LAYOUT_LIBRARY[0]?.id ?? "lifestyle-hero");
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? "");
  const [urlsText, setUrlsText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number; message?: string } | null>(null);

  const urls = urlsText
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s));

  const totalQueued = urls.length + files.length;

  async function importBatch() {
    setBusy(true);
    setResult(null);
    let ok = 0;
    let failed = 0;
    try {
      const baseTags = [layout, storeSlug, PROMPT_VERSION, "ai-generated", "hero", "agent:higgsfield"];

      // 1. URLs first — let Sendify fetch them server-side.
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const r = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `higgsfield-${layout}-${storeSlug}-${Date.now()}-${i}`,
            url,
            tags: baseTags,
            generatedBy: "agent:higgsfield",
            notes: "Importado via Higgsfield connector",
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.ok) ok++; else failed++;
      }

      // 2. File drops — read as base64 and POST. Big files take longer.
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("file read failed"));
          reader.readAsDataURL(f);
        });
        const r = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: f.name.replace(/\.[^.]+$/, "") || `higgsfield-${layout}-${storeSlug}-${i}`,
            base64: b64,
            mimeType: f.type || "image/jpeg",
            tags: baseTags,
            generatedBy: "agent:higgsfield",
            notes: "Importado via Higgsfield connector",
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.ok) ok++; else failed++;
      }

      setResult({ ok, failed });
      if (failed === 0) {
        setUrlsText("");
        setFiles([]);
      }
    } catch (e) {
      setResult({ ok, failed, message: e instanceof Error ? e.message : "import failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card/30 p-4 space-y-4">
      <div>
        <div className="text-[14px] font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground/70" /> Conector Higgsfield
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
          Higgsfield no expone API pública, así que el conector es un puente manual: generas las fotos en Higgsfield, pegas las URLs (o arrastras los archivos) abajo, eliges para qué layout + tienda son, y Sendify las mete en el pool con los tags correctos. La próxima generación de email las coge sin llamar a Gemini.
        </div>
      </div>

      {/* Credential slot — Higgsfield has no API but we keep the email/label
          encrypted so it lives next to the rest of the integrations. */}
      <CredentialCard
        provider="IMAGE_HIGGSFIELD"
        scope="default"
        title="Cuenta Higgsfield (opcional, sólo para tu referencia)"
        hint="Email + label de la cuenta — Higgsfield no tiene token oficial. Se guarda encriptado por si mañana exponen API."
        detail="Si en algún momento Higgsfield publica una API REST, este es el slot donde irá el token."
        helpUrl="https://higgsfield.ai"
        helpUrlLabel="Abrir Higgsfield →"
      />

      {/* Bulk import */}
      <div className="rounded-md border border-border bg-card/40 p-3 space-y-3">
        <div className="text-[13px] font-medium">Importar batch al pool</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Para qué layout</span>
            <Select value={layout} onValueChange={setLayout}>
              <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAYOUT_LIBRARY.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-[13px]">{l.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Para qué tienda</span>
            <Select value={storeSlug} onValueChange={setStoreSlug}>
              <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.slug} value={s.slug} className="text-[13px]">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" /> URLs de Higgsfield (una por línea)
          </div>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={4}
            placeholder={"https://higgsfield-cdn.com/abc.jpg\nhttps://higgsfield-cdn.com/def.jpg\n..."}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] font-mono resize-y focus:outline-none focus:border-foreground/40"
          />
          <div className="text-[11px] text-muted-foreground mt-1">{urls.length} URL{urls.length === 1 ? "" : "s"} válida{urls.length === 1 ? "" : "s"}</div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Upload className="h-3 w-3" /> O arrastra los archivos descargados
          </div>
          <label className="block border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:bg-secondary/40 text-[13px] text-muted-foreground">
            <Upload className="h-4 w-4 mx-auto mb-1" />
            {files.length > 0 ? `${files.length} archivo${files.length === 1 ? "" : "s"} seleccionado${files.length === 1 ? "" : "s"} · click para añadir más` : "Click o arrastra imágenes aquí"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])])}
            />
          </label>
        </div>

        {result && (
          <div className={`rounded-md border p-2.5 text-[12.5px] flex items-start gap-2 ${result.failed === 0 ? "border-[color:var(--positive)]/40 bg-[color-mix(in_oklch,var(--positive)_8%,transparent)] text-[color:var(--positive)]" : "border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] text-[color:var(--warning)]"}`}>
            {result.failed === 0 ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <span>
              {result.ok} importado{result.ok === 1 ? "" : "s"}
              {result.failed > 0 && ` · ${result.failed} fallido${result.failed === 1 ? "" : "s"}`}
              {result.message && ` · ${result.message}`}
            </span>
          </div>
        )}

        <Button
          onClick={importBatch}
          disabled={busy || totalQueued === 0 || !storeSlug}
          className="w-full"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar {totalQueued > 0 ? `${totalQueued} ` : ""}al pool · {layout} · {storeSlug}
        </Button>
      </div>
    </div>
  );
}
