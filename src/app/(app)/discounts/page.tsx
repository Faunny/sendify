import { Ticket, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function DiscountsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Discounts"
        description="Códigos únicos por destinatario (auto-generados por flows abandoned-cart / win-back / birthday) y códigos compartibles manuales. Sincronizados con Shopify Discount API en el momento de la creación."
        actions={
          <>
            <Button variant="outline" size="sm"><Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Generar lote</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Nuevo código</Button>
          </>
        }
      />

      <EmptyState
        icon={<Ticket className="h-5 w-5" />}
        title="Sin códigos creados"
        description="Genera un código compartible (FELIZ24) o deja que los flows creen códigos únicos por cliente (VUELVE-7K2P9X) en abandoned cart, win-back y birthday. Cada código se crea contra Shopify Discount API y se trackea aquí."
        primaryAction={{ label: "Crear código (próximamente)", href: "/settings" }}
      />
    </div>
  );
}
