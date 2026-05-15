"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, Palette as PaletteIcon, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { STORES, type BrandKit, type LegalEntity } from "@/lib/mock";
import { cn } from "@/lib/utils";

type BrandDraft = {
  storeId: string;
  logoUrl: string;
  logoDarkUrl?: string;
  palette: BrandKit["palette"];
  fontHeading: string;
  fontBody: string;
};

const FONTS_HEADING = ["Playfair Display", "Cormorant Garamond", "DM Serif Display", "Geist", "Inter", "Helvetica Neue"];
const FONTS_BODY    = ["Inter", "Geist", "Helvetica Neue", "Arial", "Georgia"];

const PALETTE_PRESETS: { name: string; palette: BrandKit["palette"] }[] = [
  { name: "Divain gold",   palette: { primary: "#0E0E0E", accent: "#D4AF7A", bg: "#FBF8F3", text: "#1A1A1A" } },
  { name: "Care green",    palette: { primary: "#2D4A3E", accent: "#C4986F", bg: "#F5F1EA", text: "#1A1A1A" } },
  { name: "Editorial cream", palette: { primary: "#1A1A1A", accent: "#A68B5B", bg: "#F3EBDE", text: "#1A1A1A" } },
  { name: "Midnight",      palette: { primary: "#FFFFFF", accent: "#D4AF7A", bg: "#0E0E0E", text: "#FFFFFF" } },
  { name: "Rose",          palette: { primary: "#3D1F2C", accent: "#C97B89", bg: "#FAF1F0", text: "#1A1A1A" } },
  { name: "Forest",        palette: { primary: "#1F3A2E", accent: "#8FB069", bg: "#F2F5EE", text: "#1A1A1A" } },
];

export default function BrandKitEditorPage() {
  const [storeId, setStoreId] = useState(STORES[0].id);
  const store = STORES.find((s) => s.id === storeId)!;
  const [draft, setDraft] = useState<BrandDraft>(() => ({
    storeId: store.id,
    logoUrl: store.brand.logoUrl,
    logoDarkUrl: store.brand.logoDarkUrl,
    palette: { ...store.brand.palette },
    fontHeading: store.brand.fontHeading,
    fontBody: store.brand.fontBody,
  }));

  function switchStore(id: string) {
    const s = STORES.find((x) => x.id === id);
    if (!s) return;
    setStoreId(id);
    setDraft({
      storeId: s.id,
      logoUrl: s.brand.logoUrl,
      logoDarkUrl: s.brand.logoDarkUrl,
      palette: { ...s.brand.palette },
      fontHeading: s.brand.fontHeading,
      fontBody: s.brand.fontBody,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/settings"><ArrowLeft className="h-3.5 w-3.5" /> Settings</Link>
        </Button>
        <PageHeader
          title="Brand kit"
          description="Logo, palette and typography for each store. La página todavía es preview (mockup) — los cambios no se guardan a DB. Para subir el logo real ve a /templates (botón inline) o a la sección Stores en /settings."
        />
      </div>

      {/* Store switcher (as horizontal tabs) */}
      <Tabs value={storeId} onValueChange={switchStore}>
        <TabsList className="flex-wrap h-auto">
          {STORES.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              <span className="h-3 w-3 rounded-sm mr-1.5" style={{ background: s.brand.palette.accent }} />
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {STORES.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4">
              {/* ── Editor ── */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Upload className="h-3.5 w-3.5 text-muted-foreground" /> Logo</CardTitle>
                    <CardDescription>SVG or PNG with transparent background. Used in email headers and the platform header.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <LogoSlot label="Light background" url={draft.logoUrl} swatch={draft.palette.bg} onChange={(u) => setDraft((d) => ({ ...d, logoUrl: u }))} />
                    <LogoSlot label="Dark background (optional)" url={draft.logoDarkUrl ?? draft.logoUrl} swatch="#0E0E0E" onChange={(u) => setDraft((d) => ({ ...d, logoDarkUrl: u }))} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PaletteIcon className="h-3.5 w-3.5 text-muted-foreground" /> Palette</CardTitle>
                    <CardDescription>Drives backgrounds, buttons and accents in every generated email.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <ColorField label="Primary" hint="Buttons, headings" value={draft.palette.primary} onChange={(v) => setDraft((d) => ({ ...d, palette: { ...d.palette, primary: v } }))} />
                      <ColorField label="Accent" hint="Hover, badges, links" value={draft.palette.accent} onChange={(v) => setDraft((d) => ({ ...d, palette: { ...d.palette, accent: v } }))} />
                      <ColorField label="Background" hint="Email body bg" value={draft.palette.bg} onChange={(v) => setDraft((d) => ({ ...d, palette: { ...d.palette, bg: v } }))} />
                      <ColorField label="Text" hint="Body copy" value={draft.palette.text} onChange={(v) => setDraft((d) => ({ ...d, palette: { ...d.palette, text: v } }))} />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Or start from a preset</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PALETTE_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            onClick={() => setDraft((d) => ({ ...d, palette: { ...p.palette } }))}
                            className="group rounded-md border border-border bg-card/40 p-2 text-left hover:border-[color:var(--accent)] transition-colors"
                          >
                            <div className="flex items-center gap-0.5 mb-1.5">
                              {Object.values(p.palette).map((c, i) => (
                                <div key={i} className="h-5 flex-1 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
                              ))}
                            </div>
                            <div className="text-[12px] font-medium">{p.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Type className="h-3.5 w-3.5 text-muted-foreground" /> Typography</CardTitle>
                    <CardDescription>Email-safe fonts only. Sendify falls back to Helvetica if Gmail/Outlook can't load the web font.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Heading">
                      <Select value={draft.fontHeading} onValueChange={(v) => setDraft((d) => ({ ...d, fontHeading: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FONTS_HEADING.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Body">
                      <Select value={draft.fontBody} onValueChange={(v) => setDraft((d) => ({ ...d, fontBody: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FONTS_BODY.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <div className="sm:col-span-2 rounded-md border border-border bg-card/40 p-4 text-center">
                      <div style={{ fontFamily: draft.fontHeading }} className="text-[26px] tracking-tight">The fragrance she'll actually wear</div>
                      <p style={{ fontFamily: draft.fontBody }} className="mt-2 text-[14px] text-muted-foreground">A curated edit of scents she'll fall for this Mother's Day.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Legal entity</CardTitle>
                    <CardDescription>Rendered automatically in every email footer. Edit values directly here.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Legal name (razón social)"><Input defaultValue={s.legal.legalName} /></Field>
                    <Field label="VAT / CIF"><Input defaultValue={s.legal.vatNumber} /></Field>
                    <Field label="Address"><Input defaultValue={s.legal.address} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Postal code"><Input defaultValue={s.legal.postalCode} /></Field>
                      <Field label="City"><Input defaultValue={s.legal.city} /></Field>
                    </div>
                    <Field label="Country"><Input defaultValue={s.legal.country} /></Field>
                    <Field label="Support email"><Input defaultValue={s.legal.supportEmail} /></Field>
                    <Field label="Support phone"><Input defaultValue={s.legal.supportPhone} /></Field>
                    <Field label="Privacy URL"><Input defaultValue={s.legal.privacyUrl} /></Field>
                    <Field label="Terms URL"><Input defaultValue={s.legal.termsUrl} /></Field>
                    <Field label="Cookies URL"><Input defaultValue={s.legal.cookiesUrl} /></Field>
                  </CardContent>
                </Card>
              </div>

              {/* ── Live preview ── */}
              <div className="lg:sticky lg:top-20 self-start space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Live email preview</div>
                  <Badge variant="muted">{s.shopifyDomain}</Badge>
                </div>
                <EmailPreview brand={draft} legal={s.legal} storeName={s.name} />
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent text-[13px] font-mono focus:outline-none" spellCheck={false} />
        <button onClick={() => navigator.clipboard?.writeText(value)} className="text-[11px] text-muted-foreground hover:text-foreground px-1.5">Copy</button>
      </div>
    </div>
  );
}

function LogoSlot({ label, url, swatch, onChange }: { label: string; url: string; swatch: string; onChange: (url: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <label
        className="relative aspect-[2/1] rounded-md border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-[color:var(--accent)] transition-colors overflow-hidden group"
        style={{ background: swatch }}
      >
        {url ? (
          <Image src={url} alt="" fill className="object-contain p-6" sizes="240px" />
        ) : (
          <div className="text-[12px] text-muted-foreground flex flex-col items-center gap-1">
            <Upload className="h-4 w-4" />
            Drop file or click
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
          <div className="text-white text-[12px] flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Replace
          </div>
        </div>
        <input type="file" accept="image/*,.svg" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onChange(reader.result as string);
          reader.readAsDataURL(file);
        }} />
      </label>
      <Input value={url} onChange={(e) => onChange(e.target.value)} placeholder="Or paste URL…" className="h-7 text-[12px]" />
    </div>
  );
}

function EmailPreview({ brand, legal, storeName }: { brand: BrandDraft; legal: LegalEntity; storeName: string }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xl">
      <div className="border-b border-border bg-card/60 px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--danger)]/40" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--warning)]/40" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--positive)]/40" />
        </div>
        <span>inbox preview</span>
      </div>
      <div style={{ background: brand.palette.bg, color: brand.palette.text }}>
        <div className="max-w-[420px] mx-auto py-6 px-5">
          <div className="text-center mb-4">
            <div className="text-[8px] tracking-[0.3em] uppercase opacity-60">{storeName}</div>
            <div className={cn("mt-3 h-10 mx-auto w-32 bg-cover bg-center", !brand.logoUrl && "border border-dashed border-current/30")} style={{ backgroundImage: brand.logoUrl ? `url(${brand.logoUrl})` : undefined }} />
          </div>
          <div className="aspect-[3/2] w-full rounded mb-4 grid place-items-center" style={{ background: `linear-gradient(135deg, ${brand.palette.accent}33, ${brand.palette.bg} 60%, ${brand.palette.accent}22)` }}>
            <div className="text-center px-4" style={{ color: brand.palette.text }}>
              <div style={{ fontFamily: brand.fontHeading }} className="text-[18px] leading-tight">For her, what truly moves her</div>
            </div>
          </div>
          <p style={{ fontFamily: brand.fontBody }} className="text-[13px] leading-relaxed mb-4 text-center">A curated edit of scents she'll fall for. Each one, 100ml of long-lasting fragrance.</p>
          <div className="text-center mb-5">
            <span className="inline-block px-5 py-2.5 text-[11px] tracking-wider uppercase font-medium" style={{ background: brand.palette.primary, color: brand.palette.primary === "#FFFFFF" ? brand.palette.bg : "#FFFFFF", borderRadius: 2 }}>
              Shop the edit
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded grid place-items-center" style={{ background: `${brand.palette.accent}22` }}>
                <span className="text-[8px] opacity-50">Product {i}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 text-center text-[8px] leading-relaxed opacity-60" style={{ borderColor: brand.palette.text + "22" }}>
            <div><strong>{legal.legalName}</strong> · {legal.vatNumber}</div>
            <div>{legal.address}, {legal.postalCode} {legal.city}, {legal.country}</div>
            <div className="mt-1">{legal.supportEmail} · {legal.supportPhone}</div>
            <div className="mt-1.5 space-x-1.5">
              <a className="underline">Privacy</a> · <a className="underline">Terms</a> · <a className="underline">Cookies</a> · <a className="underline">Unsubscribe</a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-card/40 px-3 py-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Updates live as you edit</span>
        <span className="text-[color:var(--positive)] flex items-center gap-1"><Check className="h-2.5 w-2.5" /> Auto-saved 2s ago</span>
      </div>
    </div>
  );
}
