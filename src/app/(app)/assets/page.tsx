"use client";

import { useState } from "react";
import { Image as ImageIcon, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

// Asset library. Empty until you upload an image, generate one with Nano Banana, or have the
// external agent endpoint push assets. Generation requires GEMINI_API_KEY in env.

export default function AssetsPage() {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("3:2");
  const [style, setStyle] = useState("luxury-minimal");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Asset library"
        description="Fotos, GIFs, banners. Generación con Gemini 2.5 Flash Image (a.k.a. Nano Banana), upload desde disco, o ingesta del agente externo."
        actions={
          <>
            <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5" /> Subir</Button>
            <Button size="sm"><Sparkles className="h-3.5 w-3.5" /> Generar</Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Generar un banner con AI</CardTitle>
          <CardDescription>Google <strong>Gemini 2.5 Flash Image</strong> (Nano Banana) · ~$0.04 por imagen · paleta de marca inyectada automáticamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe el banner que quieres… ej: 'Día de la Madre, mujer mirando puesta de sol, gold tones, perfume bottle silhouette'" />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={aspect} onValueChange={setAspect}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3:2">3:2 · Banner</SelectItem>
                <SelectItem value="16:9">16:9 · Hero</SelectItem>
                <SelectItem value="1:1">1:1 · Square</SelectItem>
                <SelectItem value="9:16">9:16 · Story</SelectItem>
              </SelectContent>
            </Select>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="luxury-minimal">Luxury · minimal</SelectItem>
                <SelectItem value="editorial">Editorial · soft</SelectItem>
                <SelectItem value="playful">Playful · warm</SelectItem>
                <SelectItem value="bold">Bold · high contrast</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground ml-auto">
              <input type="checkbox" defaultChecked className="accent-[color:var(--accent)]" />
              Sin texto en la imagen (mejor para fan-out a 22 idiomas)
            </label>
          </div>
          <div className="rounded-md border border-dashed border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
            <span className="text-foreground font-medium">Prompt del sistema (se añade automáticamente):</span> Brand divain. Palette: #0E0E0E, #D99425. Editorial clean composition. No text or typography in the image.
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-muted-foreground">Necesita GEMINI_API_KEY configurada en Settings → Integrations</span>
            <Button size="sm" disabled={!prompt}><Sparkles className="h-3.5 w-3.5" /> Generar 4 variantes</Button>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={<ImageIcon className="h-5 w-5" />}
        title="Sin assets todavía"
        description="Sube fotos, GIFs y banners desde el disco; o genera banners directamente con el módulo de arriba (Gemini 2.5 Flash Image). Todo se sube a S3 + CloudFront y se sirve desde el CDN cuando los emails se envían."
        primaryAction={{ label: "Generar con AI · arriba", href: "#generate" }}
      />
    </div>
  );
}
