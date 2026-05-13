import Image from "next/image";
import Link from "next/link";
import { Boxes, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ResyncButton } from "@/components/app/resync-button";
import { prisma } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

// Products list backed by Postgres. Each row = one (Product × Store) pairing — same SKU
// can exist in 4 stores. Pricing pulled from ProductPrice (per-market). Until first
// Shopify sync this renders the empty state with a CTA to /settings.

const PILLAR_TONE: Record<string, "muted" | "accent" | "warning" | "positive"> = {
  parfums: "muted", care: "accent", home: "warning", ritual: "positive",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const params = await searchParams;
  const storeFilter = params.store ?? "all";

  const stores = await prisma.store.findMany({ orderBy: { slug: "asc" } }).catch(() => []);
  const where: Prisma.ProductWhereInput = {
    ...(storeFilter !== "all" && { storeId: storeFilter }),
  };

  const total = await prisma.product.count({ where }).catch(() => 0);

  if (total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Products"
          description="Catálogo replicado desde las 4 Shopify Plus. Precios por mercado se rellenan desde Shopify Markets cuando hagas sync."
          actions={
            <Button size="sm" asChild>
              <Link href="/settings">Conectar Shopify</Link>
            </Button>
          }
        />
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="Catálogo vacío"
          description="Pega un Shopify Plus access token en /settings → Stores y dale a 'Sync now'. Los productos aparecen aquí con fotos, variantes, stock y precios por mercado. Los webhooks Shopify mantienen todo al día sin que toques nada."
          primaryAction={{ label: "Conectar Shopify", href: "/settings" }}
        />
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { shopifyUpdatedAt: "desc" },
    take: 60,
    include: {
      store: { select: { name: true, currency: true, countryCode: true } },
      variants: {
        take: 1,
        include: {
          prices: {
            where: { active: true },
            take: 1,
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  }).catch(() => []);

  const lowStock = products.filter((p) => (p.variants[0]?.inventoryQty ?? 0) < 50).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        description={`${formatNumber(total)} productos sincronizados`}
        actions={<ResyncButton stores={stores.map((s) => ({ slug: s.slug, name: s.name }))} />}
      />

      <form method="GET" className="flex items-center gap-2 flex-wrap">
        <select name="store" defaultValue={storeFilter} className="h-9 rounded-md border border-border bg-card px-3 text-[13px]">
          <option value="all">All stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button type="submit" size="sm" variant="outline">Aplicar</Button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {products.map((p) => {
          const variant = p.variants[0];
          const price = variant?.prices[0];
          const isLow = (variant?.inventoryQty ?? 0) < 50;
          return (
            <Card key={p.id} className="overflow-hidden p-0 hover:border-border/80 transition-colors group">
              <div className="aspect-square relative overflow-hidden bg-muted">
                {p.imageUrl && (
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(min-width: 1024px) 220px, 50vw" />
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  {isLow && <Badge variant="warning"><AlertCircle className="h-2.5 w-2.5" /> low</Badge>}
                </div>
                <div className="absolute top-2 right-2">
                  <Badge variant={PILLAR_TONE[p.productType?.toLowerCase() ?? "parfums"] ?? "muted"} className="bg-black/60 text-white border-transparent">
                    {p.store.name.split("·")[1]?.trim() ?? p.store.name}
                  </Badge>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-[14px] font-medium leading-tight line-clamp-2 min-h-[2.5em]">{p.title}</div>
                <div className="flex items-end justify-between pt-1">
                  <div>
                    {price ? (
                      <div className="text-[15px] font-medium tabular-nums">{formatCurrency(Number(price.price), price.currency)}</div>
                    ) : (
                      <div className="text-[12px] text-muted-foreground italic">no price yet</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">stock</div>
                    <div className="text-[12px] tabular-nums">{variant?.inventoryQty ?? "—"}</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {lowStock > 0 && (
        <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_5%,transparent)] p-3 text-[12px]">
          {lowStock} producto{lowStock > 1 ? "s" : ""} con stock bajo (≤50). Considera generar un flow de restock alert.
        </div>
      )}
    </div>
  );
}
