import { Ticket, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const codes = await prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { store: { select: { name: true, slug: true } } },
  }).catch(() => []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Discounts"
        description={codes.length === 0
          ? "Códigos únicos por destinatario (auto-generados por flows abandoned-cart / win-back / birthday) y códigos compartibles manuales. Se sincronizan con Shopify Discount API al crearse."
          : `${codes.length} códigos · creados automáticamente por flows o a mano. Cada uno se crea contra Shopify Discount API.`}
      />

      {codes.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-5 w-5" />}
          title="Sin códigos creados"
          description="Cuando un flow de abandoned cart / win-back / birthday se dispare, generará un código único por cliente automáticamente. También puedes crear códigos compartibles a mano (FELIZ24, VERANO25) — tab Discounts en Shopify."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Código</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-right px-3 py-2 font-medium">Valor</th>
                <th className="text-left px-3 py-2 font-medium">Para</th>
                <th className="text-right px-3 py-2 font-medium">Usos</th>
                <th className="text-left px-3 py-2 font-medium">Store</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-mono text-[12.5px]">{c.code}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="muted" className="text-[11px]">{c.kind}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {c.kind === "PERCENT" ? `${Number(c.value)}%` : `${Number(c.value)} €`}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground truncate max-w-[200px]">
                    {c.customerEmail ?? <span className="italic">compartible</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.usedCount}/{c.usageLimit}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{c.store.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="rounded-md border border-border bg-card/30 p-3 text-[12.5px] text-muted-foreground flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Los flows (welcome, abandoned-cart, win-back, birthday) crean códigos únicos por cliente automáticamente cuando los activas.
          Para crear códigos compartibles a mano, hazlo en el admin de Shopify y aparecerán aquí cuando el cliente los use.
        </span>
      </div>
    </div>
  );
}
