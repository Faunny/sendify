import { Workflow, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function FlowsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Flows"
        description="Automatizaciones disparadas por eventos de Shopify: welcome, abandoned cart, post-purchase, win-back, browse abandonment, restock, cumpleaños. Cada flow es multilingüe end-to-end."
        actions={<Button size="sm"><Plus className="h-3.5 w-3.5" /> Nuevo flow</Button>}
      />

      <EmptyState
        icon={<Workflow className="h-5 w-5" />}
        title="Sin flows configurados"
        description="Plantillas pre-construidas (welcome series, abandoned cart 1h/24h/48h, win-back 60/90/120d, restock alert, cumpleaños) aparecerán aquí cuando las actives. Cada una se enrola sola en función de los webhooks Shopify."
        primaryAction={{ label: "Crear flow (próximamente)", href: "/templates" }}
      />
    </div>
  );
}
