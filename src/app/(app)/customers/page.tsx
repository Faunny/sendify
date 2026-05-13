import Link from "next/link";
import { Users, Download, Search, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { prisma } from "@/lib/db";
import { languageByCode } from "@/lib/languages";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Prisma } from "@prisma/client";

const STATUS_VARIANT: Record<string, "positive" | "muted" | "danger" | "warning"> = {
  SUBSCRIBED: "positive",
  UNSUBSCRIBED: "muted",
  PENDING: "warning",
  BOUNCED: "danger",
  COMPLAINED: "danger",
};

const PAGE_SIZE = 50;

type Search = { q?: string; store?: string; status?: string; page?: string };

// Customers list backed by Postgres. Empty → friendly empty state. Populated → table
// with search by email/name, filter by store and consent status, paginated 50/page.
// Once Shopify sync runs (Settings → Stores → Sync now), this page fills automatically.

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q       = (params.q ?? "").trim();
  const storeId = params.store ?? "all";
  const status  = params.status ?? "all";
  const page    = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // ── Pull stores (always available — these are seeded config rows) ──
  const stores = await prisma.store.findMany({ orderBy: { slug: "asc" } }).catch(() => []);

  // ── Build the where clause from filters ──
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(storeId !== "all" && { storeId }),
    ...(status !== "all"  && { consentStatus: status as never }),
    ...(q && {
      OR: [
        { email:     { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName:  { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  // ── Query ──
  const [total, totals, customers] = await Promise.all([
    prisma.customer.count({ where }).catch(() => 0),
    // Aggregate counts for the stat tiles — done as raw groupBy so we get them in one query
    prisma.customer.groupBy({
      by: ["consentStatus"],
      _count: { _all: true },
      where: { deletedAt: null },
    }).catch(() => [] as { consentStatus: string; _count: { _all: number } }[]),
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        storeId: true, country: true, language: true,
        totalSpent: true, ordersCount: true, hasApp: true, consentStatus: true,
      },
    }).catch(() => []),
  ]);

  const byStatus = Object.fromEntries(totals.map((t) => [t.consentStatus, t._count._all]));
  const totalAll = Object.values(byStatus).reduce((s, n) => s + (n as number), 0);

  if (totalAll === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Customers"
          description="Sincronizados desde las 4 Shopify Plus en tiempo real. Idioma, país, app, consent y suppression list fluyen automáticamente a los segmentos."
          actions={
            <Button size="sm" asChild>
              <Link href="/import">Importar de Klaviyo</Link>
            </Button>
          }
        />
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Sin clientes todavía"
          description="Para tener tu 1.5M de clientes en Sendify hay dos caminos: importar el CSV exportado de Klaviyo, o conectar las 4 Shopify Plus y dejar que la sync los traiga (con historial de compras incluido). Te recomiendo Shopify primero — es la fuente de verdad para órdenes y LTV — y luego Klaviyo para enriquecer con subscription state."
          primaryAction={{ label: "Conectar Shopify", href: "/settings" }}
          secondaryAction={{ label: "Importar Klaviyo CSV", href: "/import" }}
        />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description={`${formatNumber(totalAll)} clientes sincronizados a través de ${stores.length} tiendas`}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
            <Button size="sm" asChild>
              <Link href="/import">Importar más</Link>
            </Button>
          </>
        }
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total"        value={formatNumber(totalAll)} />
        <Stat label="Subscribed"   value={formatNumber(byStatus.SUBSCRIBED ?? 0)}                                  tone="positive" />
        <Stat label="Unsubscribed" value={formatNumber(byStatus.UNSUBSCRIBED ?? 0)} />
        <Stat label="Bounced + complaints" value={formatNumber((byStatus.BOUNCED ?? 0) + (byStatus.COMPLAINED ?? 0))} tone={(byStatus.BOUNCED ?? 0) > 100 ? "danger" : undefined} />
      </div>

      {/* Filters */}
      <form method="GET" className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por email, nombre…" className="pl-8" />
        </div>
        <select name="store" defaultValue={storeId} className="h-9 rounded-md border border-border bg-card px-3 text-[13px]">
          <option value="all">All stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="status" defaultValue={status} className="h-9 rounded-md border border-border bg-card px-3 text-[13px]">
          <option value="all">All status</option>
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
          <option value="PENDING">Pending</option>
          <option value="BOUNCED">Bounced</option>
          <option value="COMPLAINED">Complained</option>
        </select>
        <Button type="submit" size="sm">Aplicar</Button>
      </form>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-[12px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Customer</th>
                <th className="text-left font-medium px-3 py-2.5">Store</th>
                <th className="text-left font-medium px-3 py-2.5">Lang</th>
                <th className="text-left font-medium px-3 py-2.5">Country</th>
                <th className="text-left font-medium px-3 py-2.5">Consent</th>
                <th className="text-center font-medium px-3 py-2.5">App</th>
                <th className="text-right font-medium px-3 py-2.5">Orders</th>
                <th className="text-right font-medium px-5 py-2.5">Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const store = stores.find((s) => s.id === c.storeId);
                const lang = languageByCode(c.language ?? "es-ES");
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-2.5">
                      <Link href={`/customers/${c.id}`} className="block">
                        <div className="text-[14px] font-medium hover:text-[color:var(--accent)]">{c.firstName} {c.lastName}</div>
                        <div className="text-[12px] text-muted-foreground truncate max-w-[260px]">{c.email}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-muted-foreground">{store?.name.replace("divain · ", "") ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[13px]">{lang?.flag ?? ""} {c.language}</td>
                    <td className="px-3 py-2.5 text-[13px]">{c.country ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_VARIANT[c.consentStatus] ?? "muted"}>{c.consentStatus.toLowerCase()}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.hasApp ? <Smartphone className="h-3.5 w-3.5 inline text-[color:var(--accent)]" /> : <span className="text-muted-foreground text-[11px]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">{c.ordersCount}</td>
                    <td className="px-5 py-2.5 text-right text-[13px] tabular-nums">{formatCurrency(Number(c.totalSpent), store?.currency ?? "EUR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {formatNumber(total)}</span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={`?${new URLSearchParams({ q, store: storeId ?? "all", status: status ?? "all", page: String(page - 1) }).toString()}`} className="rounded px-2 py-1 hover:bg-secondary/60">← Prev</Link>
            )}
            <span className="px-2">{page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={`?${new URLSearchParams({ q, store: storeId ?? "all", status: status ?? "all", page: String(page + 1) }).toString()}`} className="rounded px-2 py-1 hover:bg-secondary/60">Next →</Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-[22px] font-medium tabular-nums ${
          tone === "positive" ? "text-[color:var(--positive)]" : tone === "danger" ? "text-[color:var(--danger)]" : ""
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
