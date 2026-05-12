import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        description="Catálogo replicado desde las 4 Shopify Plus. Precios por mercado (EUR/GBP/USD/MXN) en una matriz — cada email muestra el precio correcto del mercado del destinatario."
        actions={
          <Button size="sm" asChild>
            <Link href="/settings">Conectar Shopify</Link>
          </Button>
        }
      />

      <EmptyState
        icon={<Boxes className="h-5 w-5" />}
        title="Catálogo vacío"
        description="Cuando conectes las 4 Shopify Plus (Europa, UK, USA+CA, México), los productos se sincronizan automáticamente con sus precios por mercado, fotos, stock y variantes. Los webhooks mantienen todo al día."
        primaryAction={{ label: "Conectar Shopify", href: "/settings" }}
      />
    </div>
  );
}
