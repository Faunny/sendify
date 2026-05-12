"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Boxes, Filter, RefreshCw, Search, ShoppingBag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { BRAND_PILLARS, PRODUCTS, STORES } from "@/lib/mock";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const ALL_MARKETS = Array.from(new Set(STORES.flatMap((s) => s.markets))).sort();
const PILLAR_TONE: Record<string, "muted" | "accent" | "warning" | "positive"> = {
  parfums: "muted",
  care:    "accent",
  home:    "warning",
  ritual:  "positive",
};

export default function ProductsPage() {
  const [storeId, setStoreId] = useState<string>("all");
  const [pillar, setPillar] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "matrix">("grid");

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (storeId !== "all" && p.storeId !== storeId) return false;
      if (pillar !== "all" && p.pillar !== pillar) return false;
      if (search && !`${p.title} ${p.inspiredBy}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [storeId, pillar, search]);

  // Distinct SKU count (a SKU sold in 4 stores counts once)
  const uniqueSkus = new Set(PRODUCTS.map((p) => p.handle)).size;
  const lowStock = PRODUCTS.filter((p) => p.inventoryQty < 50).length;
  const byPillar = PRODUCTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.pillar] = (acc[p.pillar] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        description="Catalog mirrored from all 4 Shopify Plus stores. Per-market pricing drives the price shown in every email."
        actions={
          <>
            <Button variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Sync now</Button>
            <Button size="sm"><ShoppingBag className="h-3.5 w-3.5" /> Open in Shopify</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Unique SKUs" value={formatNumber(uniqueSkus)} hint={`${formatNumber(PRODUCTS.length)} store-rows`} />
        <Stat label="In stock" value={formatNumber(PRODUCTS.length - lowStock)} hint={`${lowStock} below threshold`} />
        <Stat label="Markets covered" value={`${ALL_MARKETS.length}`} hint={ALL_MARKETS.slice(0, 6).join(" · ") + " …"} />
        <Stat label="Last Shopify sync" value="2 min ago" hint="webhook-driven · live" tone="positive" />
      </div>

      {/* Pillar tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <PillarChip slug="all" label="All pillars" active={pillar === "all"} count={PRODUCTS.length} onClick={() => setPillar("all")} />
        {BRAND_PILLARS.map((p) => (
          <PillarChip
            key={p.slug}
            slug={p.slug}
            label={`divain. ${p.label}`}
            active={pillar === p.slug}
            count={byPillar[p.slug] ?? 0}
            onClick={() => setPillar(p.slug)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, equivalencia, handle…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm"><Filter className="h-3.5 w-3.5" /> Family</Button>
        <Button variant="ghost" size="sm">Gender</Button>
        <div className="ml-auto">
          <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "matrix")}>
            <TabsList>
              <TabsTrigger value="grid">Grid</TabsTrigger>
              <TabsTrigger value="matrix">Price matrix</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.slice(0, 30).map((p) => {
            const store = STORES.find((s) => s.id === p.storeId)!;
            const homePrice = p.prices[store.countryCode] ?? Object.values(p.prices)[0];
            const lowStockBadge = p.inventoryQty < 50;
            return (
              <Card key={p.id} className="overflow-hidden p-0 hover:border-border/80 transition-colors group">
                <div className="aspect-square relative overflow-hidden">
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(min-width: 1024px) 220px, 50vw" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge variant={PILLAR_TONE[p.pillar]} className="border-transparent">divain. {p.pillar.toUpperCase()}</Badge>
                    {lowStockBadge && <Badge variant="warning"><AlertCircle className="h-2.5 w-2.5" /> low</Badge>}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant="muted" className="bg-black/60 text-white border-transparent">{store.slug.replace("divain-", "").toUpperCase()}</Badge>
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground truncate">{p.inspiredBy}</div>
                  <div className="text-[13px] font-medium leading-tight line-clamp-2 min-h-[2.5em]">{p.title.split(" — ")[0]}</div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <div className="text-[15px] font-medium tabular-nums">{formatCurrency(homePrice.price, homePrice.currency)}</div>
                      {homePrice.compareAt && (
                        <div className="text-[10px] text-muted-foreground line-through tabular-nums">{formatCurrency(homePrice.compareAt, homePrice.currency)}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">stock</div>
                      <div className="text-[11px] tabular-nums">{p.inventoryQty}</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                  <th className="text-left font-medium px-4 py-2.5 w-[280px]">Product</th>
                  <th className="text-left font-medium px-3 py-2.5">Store</th>
                  <th className="text-right font-medium px-3 py-2.5">Stock</th>
                  {ALL_MARKETS.map((m) => (
                    <th key={m} className="text-right font-medium px-2 py-2.5">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 30).map((p) => {
                  const store = STORES.find((s) => s.id === p.storeId)!;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 shrink-0 rounded bg-cover bg-center" style={{ backgroundImage: `url(${p.imageUrl})` }} />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium truncate">{p.title.split(" — ")[0]}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.inspiredBy}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{store.slug.replace("divain-", "").toUpperCase()}</td>
                      <td className={cn("px-3 py-2.5 text-right text-[11px] tabular-nums", p.inventoryQty < 50 && "text-[color:var(--warning)]")}>{p.inventoryQty}</td>
                      {ALL_MARKETS.map((m) => {
                        const price = p.prices[m];
                        const inMarket = store.markets.includes(m);
                        return (
                          <td key={m} className={cn(
                            "px-2 py-2.5 text-right text-[11px] tabular-nums",
                            !inMarket && "text-muted-foreground/30"
                          )}>
                            {price && inMarket
                              ? <span>{price.currency === "EUR" ? "€" : price.currency === "GBP" ? "£" : "$"}{price.price.toFixed(2)}</span>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "positive" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Boxes className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-[22px] font-medium tabular-nums ${tone === "positive" ? "text-[color:var(--positive)]" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{hint}</div>
    </Card>
  );
}

function PillarChip({ slug, label, active, count, onClick }: { slug: string; label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
        active
          ? "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-foreground"
          : "border-border bg-card/40 text-muted-foreground hover:bg-secondary/40"
      )}
    >
      <span>{label}</span>
      <span className={cn("rounded-full px-1.5 py-0 text-[10px] tabular-nums", active ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)]" : "bg-muted")}>
        {count}
      </span>
      {slug === "parfums" && active && <span className="text-[10px]">{count}</span>}
    </button>
  );
}
