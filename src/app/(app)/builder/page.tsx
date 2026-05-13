"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Clipboard,
  Code,
  Columns2,
  Eye,
  Grid3x3,
  Image as ImageIcon,
  Import,
  LayoutGrid,
  Minus,
  MousePointerClick,
  Percent,
  Redo2,
  Save,
  ScrollText,
  Send,
  SeparatorHorizontal,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { Block, BLOCK_DEFAULTS, BLOCK_LABELS, BUTTON_STYLES, BlockType, DEFAULT_DOCUMENT, Document, documentToMjml } from "@/lib/builder";
import { BRAND_PILLARS, PRODUCTS, STORES } from "@/lib/mock";
import { DivainWordmark } from "@/components/app/logo";
import { cn, formatCurrency } from "@/lib/utils";

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  hero: ImageIcon,
  "big-number": Percent,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  "product-card": ShoppingBag,
  "product-grid": Grid3x3,
  "brand-pillars": LayoutGrid,
  "app-promo": Smartphone,
  spacer: Minus,
  divider: SeparatorHorizontal,
  columns: Columns2,
  footer: ScrollText,
};

// Starts with a clean divain-style skeleton: big-number hero + brand pillars + footer.
// User picks images from their own asset library — never any stock photo defaults.
const INITIAL_DOC: Document = {
  ...DEFAULT_DOCUMENT,
  blocks: [
    BLOCK_DEFAULTS["big-number"](),
    BLOCK_DEFAULTS["brand-pillars"](),
    BLOCK_DEFAULTS.footer(),
  ],
};

export default function BuilderPage() {
  const [doc, setDoc] = useState<Document>(INITIAL_DOC);
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [storeId, setStoreId] = useState("st_1");
  const [market, setMarket] = useState("ES");
  const [view, setView] = useState<"design" | "preview" | "mjml">("design");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const dragData = useRef<{ kind: "new" | "existing"; type?: BlockType; index?: number } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const selected = doc.blocks.find((b) => b.id === selectedId);

  const mjml = useMemo(
    () => documentToMjml(doc, { stores: STORES, products: PRODUCTS, storeId, market }),
    [doc, storeId, market]
  );

  // Patch is intentionally typed loosely — each Properties editor is responsible for passing
  // keys that exist on its block's props. TS narrowing inside the editor keeps it safe at call sites.
  const update = (id: string, patch: Record<string, unknown>) => {
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, props: { ...b.props, ...patch } } as Block) : b)),
    }));
  };

  function removeBlock(id: string) {
    setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function insertAt(index: number, block: Block) {
    setDoc((d) => {
      const next = [...d.blocks];
      next.splice(index, 0, block);
      return { ...d, blocks: next };
    });
    setSelectedId(block.id);
  }

  function moveExisting(from: number, to: number) {
    setDoc((d) => {
      const next = [...d.blocks];
      const [m] = next.splice(from, 1);
      const adjusted = to > from ? to - 1 : to;
      next.splice(adjusted, 0, m);
      return { ...d, blocks: next };
    });
  }

  // ── Drag handlers
  function onPaletteDragStart(type: BlockType) {
    dragData.current = { kind: "new", type };
  }
  function onBlockDragStart(index: number) {
    dragData.current = { kind: "existing", index };
  }
  function onDropAt(index: number, e: React.DragEvent) {
    e.preventDefault();
    setHoverIdx(null);
    const d = dragData.current;
    if (!d) return;
    if (d.kind === "new" && d.type) {
      insertAt(index, BLOCK_DEFAULTS[d.type]());
    } else if (d.kind === "existing" && typeof d.index === "number") {
      moveExisting(d.index, index);
    }
    dragData.current = null;
  }

  const previewWidth = device === "desktop" ? doc.widthPx : 360;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-6rem)]">
      <PageHeader
        meta={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono">tpl_new</span>
            <span>·</span>
            <span>Día de la Madre · template</span>
          </div>
        }
        title="Builder"
        description="Drag blocks to the canvas. Product cards pull live prices for the selected market. The footer is auto-rendered from the chosen store's legal entity."
        actions={
          <>
            <Button variant="ghost" size="sm"><Undo2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm"><Redo2 className="h-3.5 w-3.5" /></Button>
            <ImportDialog onImport={(blocks) => setDoc((d) => ({ ...d, blocks }))} />
            <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5" /> Test send</Button>
            <Button variant="outline" size="sm"><Save className="h-3.5 w-3.5" /> Save</Button>
            <Button size="sm"><Send className="h-3.5 w-3.5" /> Use in campaign</Button>
          </>
        }
      />

      <div className="grid grid-cols-[220px_1fr_300px] gap-3 flex-1 min-h-0">
        {/* ── Block palette ───────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="border-b border-border px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Blocks</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
              const Icon = BLOCK_ICONS[t];
              return (
                <button
                  key={t}
                  draggable
                  onDragStart={() => onPaletteDragStart(t)}
                  className="w-full flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-2 text-left text-[13px] hover:border-[color:var(--accent)] hover:bg-secondary/40 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {BLOCK_LABELS[t].label}
                </button>
              );
            })}
            <div className="mt-4 rounded-md border border-dashed border-border bg-card/40 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-[color:var(--accent)]" /> Tip
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Drag a block onto the canvas. Drop between blocks to insert there. Drag existing blocks to reorder.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Canvas ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-[color:var(--bg)] overflow-hidden flex flex-col">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="h-8 w-40 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger className="h-8 w-24 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORES.find((s) => s.id === storeId)?.markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Tabs value={view} onValueChange={(v) => setView(v as "design" | "preview" | "mjml")}>
                <TabsList>
                  <TabsTrigger value="design">Design</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="mjml"><Code className="h-3 w-3" /> MJML</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1">
              <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
              </Button>
              <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")}>
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 grid place-items-start justify-center">
            {view === "mjml" ? (
              <pre className="w-full max-w-3xl text-[12px] font-mono text-muted-foreground bg-card/40 border border-border rounded-md p-4 overflow-x-auto leading-relaxed">{mjml}</pre>
            ) : (
              <div className="transition-all" style={{ width: previewWidth }}>
                <div className="rounded-md overflow-hidden shadow-2xl" style={{ background: doc.bgColor }}>
                  <DropZone index={0} hover={hoverIdx === 0} onDragOver={(e) => { e.preventDefault(); setHoverIdx(0); }} onDrop={(e) => onDropAt(0, e)} onDragLeave={() => setHoverIdx(null)} />
                  {doc.blocks.map((b, i) => (
                    <div key={b.id} className="group">
                      <div
                        draggable
                        onDragStart={() => onBlockDragStart(i)}
                        onClick={() => setSelectedId(b.id)}
                        className={cn(
                          "relative cursor-pointer transition-all",
                          selectedId === b.id && view === "design" && "ring-2 ring-[color:var(--accent)] ring-offset-2 ring-offset-[color:var(--bg)]"
                        )}
                      >
                        {view === "design" && selectedId === b.id && (
                          <div className="absolute -top-7 right-0 flex items-center gap-1 bg-[color:var(--accent)] text-[color:var(--accent-fg)] rounded px-2 py-0.5 text-[11px] font-medium z-10">
                            <span className="capitalize">{BLOCK_LABELS[b.type].label}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="ml-1 hover:opacity-80"><Trash2 className="h-2.5 w-2.5" /></button>
                          </div>
                        )}
                        <BlockRenderer block={b} doc={doc} storeId={storeId} market={market} />
                      </div>
                      <DropZone index={i + 1} hover={hoverIdx === i + 1} onDragOver={(e) => { e.preventDefault(); setHoverIdx(i + 1); }} onDrop={(e) => onDropAt(i + 1, e)} onDragLeave={() => setHoverIdx(null)} />
                    </div>
                  ))}
                  {doc.blocks.length === 0 && (
                    <div className="p-16 text-center text-[13px] text-muted-foreground">
                      Drag your first block from the left.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Properties panel ─────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="border-b border-border px-3 py-2.5 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Properties</div>
            {selected && <Badge variant="muted" className="text-[11px]">{BLOCK_LABELS[selected.type].label}</Badge>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {!selected && (
              <div className="text-[12px] text-muted-foreground text-center py-8">
                Select a block to edit its properties.
              </div>
            )}
            {selected && <PropertiesEditor block={selected} update={update} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Drop zone between blocks ──────────────────────────────────────────────────

function DropZone({ index, hover, onDragOver, onDrop, onDragLeave }: { index: number; hover: boolean; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragLeave: () => void }) {
  void index;
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={cn(
        "h-1.5 transition-all",
        hover ? "h-10 bg-[color-mix(in_oklch,var(--accent)_20%,transparent)] border-2 border-dashed border-[color:var(--accent)]" : ""
      )}
    />
  );
}

// ── Renders a block visually on the canvas ────────────────────────────────────

function BlockRenderer({ block, doc, storeId, market }: { block: Block; doc: Document; storeId: string; market: string }) {
  const store = STORES.find((s) => s.id === storeId)!;
  const contentBg = doc.contentBgColor;

  switch (block.type) {
    case "hero":
      return (
        <div style={{ background: block.props.bgColor ?? contentBg, color: block.props.textColor ?? "#1A1A1A" }}>
          <div className="relative aspect-[3/2] w-full">
            <Image src={block.props.imageUrl} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="text-center px-6 pt-7 pb-6">
            <h2 className="text-[24px] leading-tight" style={{ fontFamily: doc.fontHeading }}>{block.props.heading}</h2>
            {block.props.subheading && <p className="mt-2 text-[13px] text-black/60">{block.props.subheading}</p>}
          </div>
        </div>
      );
    case "text":
      return (
        <div style={{ background: contentBg }} className="px-6 py-3">
          <p style={{ textAlign: block.props.align, fontSize: block.props.size, color: "#1a1a1a", lineHeight: 1.6 }}>{block.props.text}</p>
        </div>
      );
    case "image":
      return (
        <div style={{ background: contentBg, textAlign: block.props.align }} className="py-2">
          <Image src={block.props.imageUrl} alt="" width={doc.widthPx} height={Math.round(doc.widthPx * 0.5)} style={{ width: `${block.props.widthPct ?? 100}%`, height: "auto", display: "inline-block" }} />
        </div>
      );
    case "button": {
      const preset = BUTTON_STYLES[block.props.style ?? "gold"];
      const bg = block.props.bgColor ?? preset.bgColor;
      const fg = block.props.textColor ?? preset.textColor;
      return (
        <div style={{ background: contentBg, textAlign: block.props.align ?? "center" }} className="px-6 py-7">
          <span
            className="inline-block px-9 py-3 text-[12px] tracking-[1px] uppercase font-medium"
            style={{ background: bg, color: fg, borderRadius: 40, border: preset.border ?? "none", fontFamily: "Inter, Helvetica, Arial, sans-serif" }}
          >
            {block.props.label}
          </span>
        </div>
      );
    }
    case "big-number": {
      const preset = BUTTON_STYLES[block.props.ctaStyle ?? "gold"];
      return (
        <div
          className="relative overflow-hidden"
          style={{
            background: block.props.bgImageUrl
              ? `url(${block.props.bgImageUrl}) center bottom / cover no-repeat, ${block.props.bgColor ?? "#FFBDCF"}`
              : (block.props.bgColor ?? "#FFBDCF"),
            color: block.props.textColor ?? "#FFFFFF",
            minHeight: 540,
          }}
        >
          <div className="text-center pt-10 pb-12 px-6">
            <div className="text-[98px] leading-none font-bold mb-2" style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "-0.01em" }}>
              {block.props.number}
            </div>
            <div className="text-[22px] tracking-[5px] mt-3" style={{ fontFamily: "Outfit, sans-serif", fontWeight: 400 }}>
              {block.props.subtitle}
            </div>
            {block.props.tagline && (
              <div className="text-[20px] mt-2 mb-6" style={{ fontFamily: "Outfit, sans-serif", fontWeight: 400 }}>
                {block.props.tagline}
              </div>
            )}
            {block.props.ctaLabel && (
              <span
                className="inline-block px-9 py-3 text-[12px] tracking-[1px] uppercase font-medium mt-4"
                style={{ background: preset.bgColor, color: preset.textColor, borderRadius: 40, border: preset.border ?? "none", fontFamily: "Inter, sans-serif" }}
              >
                {block.props.ctaLabel}
              </span>
            )}
          </div>
        </div>
      );
    }
    case "brand-pillars": {
      const pillars = block.props.pillarSlugs
        .map((s) => BRAND_PILLARS.find((p) => p.slug === s))
        .filter(Boolean) as typeof BRAND_PILLARS;
      const fg = block.props.textColor ?? "#FFFFFF";
      return (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${pillars.length}, 1fr)`,
            background: block.props.bgColor ?? "#000000",
            color: fg,
          }}
        >
          {pillars.map((p) => (
            <div key={p.slug} className="py-4 text-center">
              <DivainWordmark size={14} color={fg} dotColor="#D99425" />
              <span className="ml-1 text-[14px] font-semibold" style={{ fontFamily: "Outfit, sans-serif", color: fg }}>{p.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case "app-promo":
      return (
        <div style={{ background: "#FFFFFF" }}>
          <div className="relative aspect-[3/2] w-full">
            <Image src={block.props.imageUrl} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="px-6 py-7 text-center" style={{ color: "#000" }}>
            <div className="text-[22px]" style={{ fontFamily: "Outfit, sans-serif", fontWeight: 400 }}>{block.props.heading}</div>
            <p className="mt-3 text-[15px]" style={{ fontFamily: "Inter, sans-serif" }}>{block.props.body}</p>
            <div className="mt-5">
              <span className="inline-block px-9 py-3 text-[11px] tracking-[1px] uppercase font-medium" style={{ background: "#FFFFFF", color: "#000", border: "1px solid #000", borderRadius: 40, fontFamily: "Inter, sans-serif" }}>
                {block.props.ctaLabel}
              </span>
            </div>
          </div>
        </div>
      );
    case "product-card": {
      const p = PRODUCTS.find((x) => x.id === block.props.productId);
      const price = p?.prices[block.props.market ?? market];
      return (
        <div style={{ background: contentBg }} className="px-6 py-4">
          {p ? (
            <div className="text-center">
              <div className="relative aspect-square w-full overflow-hidden rounded">
                <Image src={p.imageUrl} alt="" fill className="object-cover" sizes="600px" />
              </div>
              <div className="mt-3" style={{ fontFamily: doc.fontHeading }}>
                <div className="text-[18px]" style={{ color: "#1a1a1a" }}>{p.title.split(" — ")[0]}</div>
              </div>
              <div className="text-[13px] text-black/60">{p.inspiredBy}</div>
              {price && block.props.showPrice !== false && (
                <div className="mt-2 text-[16px] font-medium" style={{ color: "#1a1a1a" }}>
                  {formatCurrency(price.price, price.currency)}
                  {price.compareAt && <span className="ml-2 text-[13px] text-black/40 line-through font-normal">{formatCurrency(price.compareAt, price.currency)}</span>}
                </div>
              )}
              <div className="mt-3">
                <span className="inline-block bg-black text-white text-[12px] tracking-wider uppercase px-5 py-2.5 rounded-sm">{block.props.cta ?? "Comprar"}</span>
              </div>
            </div>
          ) : <p className="text-center text-muted-foreground">Product missing</p>}
        </div>
      );
    }
    case "product-grid": {
      const cols = block.props.columns ?? 3;
      const items = block.props.productIds.slice(0, cols).map((pid) => PRODUCTS.find((p) => p.id === pid));
      return (
        <div style={{ background: contentBg }} className="px-4 py-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {items.map((p, i) => {
              const price = p?.prices[block.props.market ?? market];
              return (
                <div key={i} className="text-center">
                  {p ? (
                    <>
                      <div className="relative aspect-square w-full overflow-hidden rounded">
                        <Image src={p.imageUrl} alt="" fill className="object-cover" sizes="200px" />
                      </div>
                      <div className="text-[12px] font-medium mt-1.5 leading-tight" style={{ color: "#1a1a1a" }}>{p.title.split(" — ")[0]}</div>
                      {price && <div className="text-[12px]" style={{ color: "#1a1a1a" }}>{formatCurrency(price.price, price.currency)}</div>}
                    </>
                  ) : <div className="aspect-square bg-black/5 grid place-items-center text-[11px] text-black/40">—</div>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "spacer":
      return <div style={{ background: contentBg, height: block.props.height ?? 24 }} />;
    case "divider":
      return <div style={{ background: contentBg }} className="px-6 py-0"><hr style={{ borderColor: block.props.color }} /></div>;
    case "columns":
      return (
        <div style={{ background: contentBg }} className="px-4 py-3 grid grid-cols-2 gap-3 text-center">
          <div className="text-[13px]" style={{ color: "#555" }}>{block.props.left.text}</div>
          <div className="text-[13px]" style={{ color: "#555" }}>{block.props.right.text}</div>
        </div>
      );
    case "footer": {
      const fStore = STORES.find((s) => s.id === block.props.storeId) ?? store;
      const l = fStore.legal;
      return (
        <div className="px-6 pt-10 pb-5 text-center" style={{ background: "#D99425", color: "#FFFFFF" }}>
          <div className="mb-4">
            <DivainWordmark size={64} color="#FFFFFF" dotColor="#FFFFFF" />
          </div>
          <div className="text-[13px] space-x-3 mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>
            <a>Instagram</a>
            <a>Facebook</a>
            <a>TikTok</a>
          </div>
          <div className="text-[12px] mb-3 italic" style={{ fontFamily: "Outfit, sans-serif" }}>
            *Promoción sujeta a términos y condiciones: <a className="underline">Consulta en nuestra web</a>.
          </div>
          <div className="text-[12px] leading-relaxed" style={{ fontFamily: "Outfit, sans-serif" }}>
            © {new Date().getFullYear()} {l.legalName} · {l.vatNumber}<br />
            {l.address}, {l.postalCode} {l.city}, {l.country}
          </div>
          <div className="text-[13px] mt-3" style={{ fontFamily: "Outfit, sans-serif" }}>
            ¿No quieres recibir más emails?<br />
            <a className="underline font-semibold">Darse de baja</a>
          </div>
        </div>
      );
    }
  }
}

// ── Properties editor ─────────────────────────────────────────────────────────

function PropertiesEditor({ block, update }: { block: Block; update: (id: string, patch: Record<string, unknown>) => void }) {
  switch (block.type) {
    case "hero":
      return (
        <>
          <Field label="Image URL"><Input value={block.props.imageUrl} onChange={(e) => update(block.id, { imageUrl: e.target.value })} /></Field>
          <Field label="Heading"><Input value={block.props.heading} onChange={(e) => update(block.id, { heading: e.target.value })} /></Field>
          <Field label="Subheading"><Input value={block.props.subheading ?? ""} onChange={(e) => update(block.id, { subheading: e.target.value })} /></Field>
          <Row>
            <Field label="Bg"><Input type="color" value={block.props.bgColor ?? "#FBF8F3"} onChange={(e) => update(block.id, { bgColor: e.target.value })} /></Field>
            <Field label="Text"><Input type="color" value={block.props.textColor ?? "#1A1A1A"} onChange={(e) => update(block.id, { textColor: e.target.value })} /></Field>
          </Row>
        </>
      );
    case "text":
      return (
        <>
          <Field label="Text">
            <textarea
              value={block.props.text}
              onChange={(e) => update(block.id, { text: e.target.value })}
              className="w-full min-h-[120px] rounded-md border border-input bg-transparent p-2 text-[13px] focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </Field>
          <Row>
            <Field label="Align">
              <Select value={block.props.align ?? "left"} onValueChange={(v) => update(block.id, { align: v as "left" | "center" | "right" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Size"><Input type="number" min={10} max={32} value={block.props.size ?? 15} onChange={(e) => update(block.id, { size: parseInt(e.target.value) })} /></Field>
          </Row>
        </>
      );
    case "image":
      return (
        <>
          <Field label="Image URL"><Input value={block.props.imageUrl} onChange={(e) => update(block.id, { imageUrl: e.target.value })} /></Field>
          <Field label="Link (href)"><Input value={block.props.href ?? ""} onChange={(e) => update(block.id, { href: e.target.value })} placeholder="https://…" /></Field>
          <Row>
            <Field label="Align">
              <Select value={block.props.align ?? "center"} onValueChange={(v) => update(block.id, { align: v as "left" | "center" | "right" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Width %"><Input type="number" min={10} max={100} value={block.props.widthPct ?? 100} onChange={(e) => update(block.id, { widthPct: parseInt(e.target.value) })} /></Field>
          </Row>
        </>
      );
    case "button":
      return (
        <>
          <Field label="Label"><Input value={block.props.label} onChange={(e) => update(block.id, { label: e.target.value })} /></Field>
          <Field label="Link"><Input value={block.props.href} onChange={(e) => update(block.id, { href: e.target.value })} /></Field>
          <Field label="Style">
            <Select value={block.props.style ?? "gold"} onValueChange={(v) => update(block.id, { style: v, bgColor: undefined, textColor: undefined })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">Divain gold (#D99425)</SelectItem>
                <SelectItem value="black">Black solid</SelectItem>
                <SelectItem value="outlined">Outlined white</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Align">
            <Select value={block.props.align ?? "center"} onValueChange={(v) => update(block.id, { align: v as "left" | "center" | "right" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
            </Select>
          </Field>
        </>
      );
    case "big-number":
      return (
        <>
          <Field label="Big number"><Input value={block.props.number} onChange={(e) => update(block.id, { number: e.target.value })} placeholder="55% · 11,99€" /></Field>
          <Field label="Subtitle (uppercase, letter-spaced)"><Input value={block.props.subtitle} onChange={(e) => update(block.id, { subtitle: e.target.value })} /></Field>
          <Field label="Tagline (optional)"><Input value={block.props.tagline ?? ""} onChange={(e) => update(block.id, { tagline: e.target.value })} /></Field>
          <Field label="Background image URL"><Input value={block.props.bgImageUrl ?? ""} onChange={(e) => update(block.id, { bgImageUrl: e.target.value })} placeholder="https://…" /></Field>
          <Row>
            <Field label="Bg color"><Input type="color" value={block.props.bgColor ?? "#FFBDCF"} onChange={(e) => update(block.id, { bgColor: e.target.value })} /></Field>
            <Field label="Text color"><Input type="color" value={block.props.textColor ?? "#FFFFFF"} onChange={(e) => update(block.id, { textColor: e.target.value })} /></Field>
          </Row>
          <Field label="CTA label"><Input value={block.props.ctaLabel ?? ""} onChange={(e) => update(block.id, { ctaLabel: e.target.value })} /></Field>
          <Field label="CTA link"><Input value={block.props.ctaHref ?? ""} onChange={(e) => update(block.id, { ctaHref: e.target.value })} /></Field>
          <Field label="CTA style">
            <Select value={block.props.ctaStyle ?? "gold"} onValueChange={(v) => update(block.id, { ctaStyle: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">Divain gold</SelectItem>
                <SelectItem value="black">Black solid</SelectItem>
                <SelectItem value="outlined">Outlined white</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      );
    case "brand-pillars":
      return (
        <>
          <Field label="Pillars">
            <div className="space-y-1.5">
              {BRAND_PILLARS.map((p) => {
                const on = block.props.pillarSlugs.includes(p.slug);
                return (
                  <label key={p.slug} className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => update(block.id, {
                        pillarSlugs: e.target.checked
                          ? [...block.props.pillarSlugs, p.slug]
                          : block.props.pillarSlugs.filter((s: string) => s !== p.slug),
                      })}
                      className="accent-[color:var(--accent)]"
                    />
                    <span className="text-[13px] font-medium">divain. {p.label}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <Row>
            <Field label="Bg"><Input type="color" value={block.props.bgColor ?? "#000000"} onChange={(e) => update(block.id, { bgColor: e.target.value })} /></Field>
            <Field label="Text"><Input type="color" value={block.props.textColor ?? "#FFFFFF"} onChange={(e) => update(block.id, { textColor: e.target.value })} /></Field>
          </Row>
        </>
      );
    case "app-promo":
      return (
        <>
          <Field label="Phone screenshot URL"><Input value={block.props.imageUrl} onChange={(e) => update(block.id, { imageUrl: e.target.value })} /></Field>
          <Field label="Heading"><Input value={block.props.heading} onChange={(e) => update(block.id, { heading: e.target.value })} /></Field>
          <Field label="Body">
            <textarea
              value={block.props.body}
              onChange={(e) => update(block.id, { body: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent p-2 text-[13px] focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </Field>
          <Field label="CTA label"><Input value={block.props.ctaLabel} onChange={(e) => update(block.id, { ctaLabel: e.target.value })} /></Field>
          <Field label="CTA link (e.g. onelink.to/…)"><Input value={block.props.ctaHref} onChange={(e) => update(block.id, { ctaHref: e.target.value })} /></Field>
        </>
      );
    case "product-card":
      return (
        <>
          <Field label="Product">
            <Select value={block.props.productId} onValueChange={(v) => update(block.id, { productId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTS.slice(0, 20).map((p) => <SelectItem key={p.id} value={p.id}>{p.title.split(" — ")[0]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="CTA label"><Input value={block.props.cta ?? "Comprar"} onChange={(e) => update(block.id, { cta: e.target.value })} /></Field>
          <Field label="Market override (price comes from)">
            <Input value={block.props.market ?? ""} onChange={(e) => update(block.id, { market: e.target.value })} placeholder="leave empty = use recipient's market" />
          </Field>
        </>
      );
    case "product-grid":
      return (
        <>
          <Field label="Columns">
            <Select value={`${block.props.columns ?? 3}`} onValueChange={(v) => update(block.id, { columns: parseInt(v) as 2 | 3 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Products (one ID per line)">
            <textarea
              value={block.props.productIds.join("\n")}
              onChange={(e) => update(block.id, { productIds: e.target.value.split("\n").filter(Boolean) })}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent p-2 text-[12px] font-mono focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </Field>
          <div className="rounded-md border border-dashed border-border bg-card/40 p-2 text-[11px] text-muted-foreground leading-relaxed">
            Or auto-pick: "top sellers · last 7 days", "recently viewed by recipient", "smart restock" — coming next.
          </div>
        </>
      );
    case "spacer":
      return <Field label="Height (px)"><Input type="number" min={4} max={200} value={block.props.height ?? 24} onChange={(e) => update(block.id, { height: parseInt(e.target.value) })} /></Field>;
    case "divider":
      return <Field label="Color"><Input type="color" value={block.props.color ?? "#E5E0D6"} onChange={(e) => update(block.id, { color: e.target.value })} /></Field>;
    case "columns":
      return (
        <>
          <Field label="Left text"><Input value={block.props.left.text} onChange={(e) => update(block.id, { left: { text: e.target.value } })} /></Field>
          <Field label="Right text"><Input value={block.props.right.text} onChange={(e) => update(block.id, { right: { text: e.target.value } })} /></Field>
        </>
      );
    case "footer":
      return (
        <>
          <Field label="Legal entity (store)">
            <Select value={block.props.storeId} onValueChange={(v) => update(block.id, { storeId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.legal.legalName}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="rounded-md border border-border bg-card/40 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
            All fields (razón social, CIF, dirección, soporte, enlaces legales) are pulled live from the store. Edit them in <strong>Settings → Stores</strong>.
          </div>
        </>
      );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// ── Import HTML or MJML ────────────────────────────────────────────────────────
//
// Lets you paste an existing email (e.g. from Klaviyo) and turn it into editable
// blocks. The conversion is heuristic — it looks for headings, paragraphs and
// images in the order they appear. Output is approximate but lossless enough to
// recover the layout, then you tweak from there.

function ImportDialog({ onImport }: { onImport: (blocks: Block[]) => void }) {
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleImport() {
    setError(null);
    const blocks = sourceToBlocks(source);
    if (blocks.length === 0) {
      setError("Couldn't find any content. Paste raw HTML or MJML.");
      return;
    }
    onImport(blocks);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Import className="h-3.5 w-3.5" /> Import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import HTML or MJML</DialogTitle>
          <DialogDescription>
            Paste an existing email and Sendify will convert it into editable blocks. Footer is dropped — the new one comes from the store legal entity.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={"<html><body>\n  <h1>Para ella…</h1>\n  <img src=\"…\" />\n  <p>Una selección…</p>\n  …\n</body></html>"}
          className="w-full min-h-[260px] rounded-md border border-input bg-transparent p-3 text-[12px] font-mono focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {error && <p className="text-[12px] text-[color:var(--danger)]">{error}</p>}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clipboard className="h-3 w-3" /> Tip: paste from Klaviyo "View HTML" or any .eml file</span>
          <span>{source.length.toLocaleString()} chars</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
          <DialogClose asChild><Button size="sm" onClick={handleImport}>Convert to blocks</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Heuristic HTML/MJML → blocks. Walks the DOM in document order picking out
// headings (→ hero or text), paragraphs (→ text), images (→ image or hero) and
// anchor buttons (→ button). Real implementation should use a parser; for the
// demo a regex pass is enough to give a usable starting point.
function sourceToBlocks(src: string): Block[] {
  if (!src.trim()) return [];
  const blocks: Block[] = [];
  let id = 0;
  const nextId = () => `i_${++id}`;

  const tokens = Array.from(
    src.matchAll(/<(h1|h2|h3|p|img|a|hr|mj-text|mj-image|mj-button)\b([^>]*)>([\s\S]*?)<\/\1>|<(img|hr|mj-image|mj-divider)\b([^>]*)\/?>/gi)
  );

  let heroPlaced = false;
  for (const m of tokens) {
    const tag = (m[1] ?? m[4] ?? "").toLowerCase();
    const attrs = (m[2] ?? m[5] ?? "");
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, "").trim();
    const src = (/src=["']([^"']+)["']/i.exec(attrs)?.[1]) ?? "";
    const href = (/href=["']([^"']+)["']/i.exec(attrs)?.[1]) ?? "";

    if (tag === "img" || tag === "mj-image") {
      if (!heroPlaced) {
        blocks.push({ id: nextId(), type: "hero", props: { imageUrl: src, heading: "Imported headline", subheading: "" } });
        heroPlaced = true;
      } else {
        blocks.push({ id: nextId(), type: "image", props: { imageUrl: src, align: "center", widthPct: 100, href: href || undefined } });
      }
    } else if (tag === "h1" || tag === "h2") {
      if (!heroPlaced) {
        blocks.push({ id: nextId(), type: "hero", props: { imageUrl: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=1200", heading: inner || "Headline", subheading: "" } });
        heroPlaced = true;
      } else {
        blocks.push({ id: nextId(), type: "text", props: { text: inner, align: "center", size: 20 } });
      }
    } else if (tag === "h3") {
      blocks.push({ id: nextId(), type: "text", props: { text: inner, align: "center", size: 18 } });
    } else if (tag === "p" || tag === "mj-text") {
      if (inner) blocks.push({ id: nextId(), type: "text", props: { text: inner, align: "left", size: 15 } });
    } else if (tag === "a" || tag === "mj-button") {
      if (inner) blocks.push({ id: nextId(), type: "button", props: { label: inner, href: href || "#", align: "center" } });
    } else if (tag === "hr" || tag === "mj-divider") {
      blocks.push({ id: nextId(), type: "divider", props: { color: "#E5E0D6" } });
    }
  }

  // Always close with the store footer.
  blocks.push({ id: nextId(), type: "footer", props: { storeId: STORES[0].id } });
  return blocks;
}
