"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Filter, Copy, Plus, Loader2, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Asset = {
  id: string;
  name: string;
  mimeType: string;
  tags: string[];
  prompt: string | null;
  notes: string | null;
  generatedBy: string | null;
  usedCount: number;
  lastUsedAt: string | null;
  sizeBytes: number | null;
  createdAt: string;
  url: string;
  serveUrl: string;
};

export function AssetLibraryClient({
  initialAssets,
  initialCounts,
}: {
  initialAssets: Asset[];
  initialCounts: { total: number; unused: number; used: number };
}) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [counts, setCounts]   = useState(initialCounts);
  const [filter, setFilter]   = useState<"all" | "unused" | "used">("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [busy, setBusy]       = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const params = new URLSearchParams({ filter, limit: "60" });
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    fetch(`/api/assets?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        setAssets(j.assets);
        setCounts(j.counts);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [filter, tagFilter]);

  // All unique tags across the visible page
  const allTags = Array.from(new Set(assets.flatMap((a) => a.tags))).sort();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={filter === "all"}    onClick={() => setFilter("all")}>Todos ({counts.total})</Pill>
        <Pill active={filter === "unused"} onClick={() => setFilter("unused")}>Sin usar ({counts.unused})</Pill>
        <Pill active={filter === "used"}   onClick={() => setFilter("used")}>Usados ({counts.used})</Pill>
        <div className="flex items-center gap-1.5 ml-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="filtrar por tag…"
            className="h-8 text-[12px] w-40"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 12).map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(t === tagFilter ? "" : t)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${t === tagFilter ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)] border-transparent" : "bg-card border-border text-muted-foreground hover:bg-secondary/60"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Subir asset
          </Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-md border border-border bg-card/40 p-8 text-center text-[13px] text-muted-foreground">
          Sin assets que matcheen el filtro.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {assets.map((a) => <AssetTile key={a.id} asset={a} />)}
        </div>
      )}

      <UploadAssetDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(newAsset) => {
          setAssets((cur) => [{ ...newAsset, serveUrl: `/api/assets/${newAsset.id}` } as Asset, ...cur]);
          setCounts((c) => ({ ...c, total: c.total + 1, unused: c.unused + 1 }));
        }}
      />
    </>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-foreground text-background border-transparent"
          : "bg-card border-border text-muted-foreground hover:bg-secondary/60"
      }`}
    >
      {children}
    </button>
  );
}

function AssetTile({ asset }: { asset: Asset }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}${asset.serveUrl}`);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const sizeKb = asset.sizeBytes ? `${Math.round(asset.sizeBytes / 1024)} KB` : "—";

  return (
    <div className="rounded-md border border-border bg-card/40 overflow-hidden group">
      <div className="aspect-[3/2] bg-[color:var(--bg)] relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.serveUrl} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
        {asset.usedCount > 0 && (
          <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/65 text-white">
            usado {asset.usedCount}×
          </span>
        )}
        <button
          onClick={copy}
          className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/65 text-white opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1"
          title="Copy URL"
        >
          <Copy className="h-2.5 w-2.5" /> {copied ? "copiado" : "url"}
        </button>
      </div>
      <div className="p-2 space-y-1">
        <div className="text-[12px] font-medium truncate" title={asset.name}>{asset.name}</div>
        <div className="flex flex-wrap gap-0.5">
          {asset.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] px-1 rounded bg-secondary text-muted-foreground">{t}</span>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
          <span>{asset.generatedBy ?? "manual"}</span>
          <span>{sizeKb}</span>
        </div>
      </div>
    </div>
  );
}

function UploadAssetDialog({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: (a: Asset) => void }) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMime, setFileMime]     = useState<string>("image/png");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileMime(f.type || "image/png");
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data:...;base64,
      setFileBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim() || `asset-${Date.now()}`,
        tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        notes: notes.trim() || undefined,
      };
      if (mode === "file") {
        if (!fileBase64) throw new Error("selecciona un archivo");
        body.base64 = fileBase64; body.mimeType = fileMime;
      } else {
        if (!/^https?:\/\//.test(url)) throw new Error("URL inválida");
        body.url = url;
      }
      const res = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "upload failed");
      onUploaded(j.asset);
      onClose();
      setName(""); setTags(""); setNotes(""); setFileBase64(null); setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Subir asset</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 text-[12px]">
            <button onClick={() => setMode("file")} className={`px-2.5 py-1 rounded border ${mode === "file" ? "bg-foreground text-background border-transparent" : "border-border"}`}>Archivo</button>
            <button onClick={() => setMode("url")}  className={`px-2.5 py-1 rounded border ${mode === "url" ? "bg-foreground text-background border-transparent" : "border-border"}`}>URL externa</button>
          </div>

          {mode === "file" ? (
            <label className="block border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:bg-secondary/40 text-[13px] text-muted-foreground">
              <Upload className="h-4 w-4 mx-auto mb-1" />
              {fileBase64 ? "Archivo seleccionado · click para cambiar" : "Click o arrastra una imagen aquí"}
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          ) : (
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (Sendify la descarga y guarda)" />
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="hero-otono-bosque-01" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Tags (separados por coma)</span>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lifestyle, otono, bosque, divain-europa" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Notas (opcional)</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="contexto / propósito" className="mt-1" />
          </label>

          {error && (
            <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2 text-[12px] text-[color:var(--danger)] flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
            </div>
          )}
          <Button onClick={submit} disabled={busy || (mode === "file" ? !fileBase64 : !url)} className="w-full">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Subir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
