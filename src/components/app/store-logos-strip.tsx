"use client";

// Inline logo uploader at the top of /templates. One card per store with
// either the current logo (small thumb) or an empty drop-zone. The owner can
// upload directly here without diving into the editor or /settings/brand.
// Calls POST /api/stores/[slug]/logo which persists the URL on Store.

import { useState } from "react";
import { Image as ImageIcon, Loader2, AlertTriangle, Check } from "lucide-react";

export type StoreLogo = { slug: string; name: string; brandLogoUrl: string | null };

export function StoreLogosStrip({ stores: initialStores }: { stores: StoreLogo[] }) {
  const [stores, setStores] = useState(initialStores);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [errorBySlug, setErrorBySlug] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState<string | null>(null);

  async function uploadFor(slug: string, file: File) {
    setBusySlug(slug);
    setErrorBySlug((m) => ({ ...m, [slug]: "" }));
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("file read failed"));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/stores/${slug}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "image/png", name: file.name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "upload failed");
      setStores((cur) => cur.map((s) => s.slug === slug ? { ...s, brandLogoUrl: json.url } : s));
      setJustSaved(slug);
      setTimeout(() => setJustSaved((c) => (c === slug ? null : c)), 2200);
    } catch (e) {
      setErrorBySlug((m) => ({ ...m, [slug]: e instanceof Error ? e.message : "upload failed" }));
    } finally {
      setBusySlug(null);
    }
  }

  const missing = stores.filter((s) => !s.brandLogoUrl).length;

  return (
    <div className="rounded-md border border-border bg-card/30 p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[14px] font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-foreground/70" /> Logo de marca por store
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {missing === 0
              ? "Las 4 stores tienen logo · aparece en el header de todos los emails."
              : missing === stores.length
                ? "Ninguna store tiene logo configurado todavía. Sube un PNG/SVG y aparecerá en cada email."
                : `${missing} ${missing === 1 ? "store sin" : "stores sin"} logo. Súbelo aquí.`}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stores.map((s) => {
          const busy = busySlug === s.slug;
          const saved = justSaved === s.slug;
          const err = errorBySlug[s.slug];
          return (
            <label
              key={s.slug}
              className="relative rounded-md border border-border bg-card hover:border-foreground/40 transition-colors p-3 cursor-pointer flex flex-col gap-2"
            >
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground truncate">{s.name}</div>
              <div className="h-20 rounded bg-white grid place-items-center overflow-hidden">
                {s.brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.brandLogoUrl} alt={s.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-[11px] text-black/40 flex flex-col items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    Sin logo
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="text-[11px] text-foreground/80 flex items-center gap-1">
                {saved
                  ? <><Check className="h-3 w-3 text-[color:var(--positive)]" /> Guardado</>
                  : s.brandLogoUrl
                    ? "Cambiar"
                    : "Subir logo"}
              </div>
              {err && (
                <div className="text-[11px] text-[color:var(--danger)] flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {err}
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFor(s.slug, f); }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
