"use client";

import { useState } from "react";
import { Filter, Image as ImageIcon, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { ASSETS } from "@/lib/mock";
import { cn } from "@/lib/utils";

export default function AssetsPage() {
  const [prompt, setPrompt] = useState("Mother's Day banner, warm gold tones, perfume bottle silhouette, soft natural light");
  const [aspect, setAspect] = useState("3:2");
  const [style, setStyle] = useState("luxury-minimal");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Asset library"
        description="Photos, GIFs, banners. Generate with Gemini 2.5 Flash Image (Nano Banana), upload from disk, or import via the agent endpoint."
        actions={
          <>
            <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5" /> Upload</Button>
            <Button size="sm"><Sparkles className="h-3.5 w-3.5" /> Generate</Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Generate a banner</CardTitle>
          <CardDescription>Gemini 2.5 Flash Image · ~$0.04 per render · brand palette injected automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the banner…" />
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
              No text in image (better for 22-language fan-out)
            </label>
          </div>
          <div className="rounded-md border border-dashed border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
            <span className="text-foreground font-medium">System prompt prepended:</span> Divain brand. Palette: #0E0E0E, #D4AF7A. Clean editorial composition. No text or typography in the image.
          </div>
          <div className="flex items-center justify-end">
            <Button size="sm"><Sparkles className="h-3.5 w-3.5" /> Generate 4 variants</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, tag, prompt…" className="pl-8" />
        </div>
        <Button variant="ghost" size="sm"><Filter className="h-3.5 w-3.5" /> All types</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {ASSETS.map((a) => (
          <Card key={a.id} className="overflow-hidden p-0 hover:border-border/80 transition-colors">
            <div className="aspect-square bg-cover bg-center relative" style={{ backgroundImage: `url(${a.url})` }}>
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/60 grid place-items-end p-2">
                <div className="flex items-center justify-between w-full">
                  <Badge variant="muted">{a.kind.toLowerCase()}</Badge>
                  {a.generatedBy?.startsWith("gemini") && (
                    <Badge variant="accent" className="gap-1"><Sparkles className="h-2.5 w-2.5" /> AI</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[11px] font-medium truncate">{a.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {a.tags.slice(0, 2).map((t) => <span key={t} className="text-[9px] text-muted-foreground rounded bg-muted px-1 py-0.5">{t}</span>)}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
