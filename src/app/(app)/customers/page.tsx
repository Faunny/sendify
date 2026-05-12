import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Clientes sincronizados desde las 4 Shopify Plus en tiempo real. Idioma, país, app, consent y suppression list fluyen automáticamente a los segmentos."
        actions={
          <Button size="sm" asChild>
            <Link href="/import">Importar de Klaviyo</Link>
          </Button>
        }
      />

      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Sin clientes todavía"
        description="Para tener los 1.5M clientes en Sendify hay dos caminos: importar el CSV exportado de Klaviyo, o conectar las 4 Shopify Plus y dejar que el webhook los sincronice (incremental, en tiempo real)."
        primaryAction={{ label: "Importar Klaviyo CSV", href: "/import" }}
        secondaryAction={{ label: "Conectar Shopify", href: "/settings" }}
      />
    </div>
  );
}
