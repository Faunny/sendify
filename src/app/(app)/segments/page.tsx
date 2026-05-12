import { Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function SegmentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Segments"
        description="Segmentos basados en comportamiento, compilados a SQL. Auto-refresh cada 6h; recompute manual con un click."
        actions={
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Nuevo segmento</Button>
        }
      />

      <EmptyState
        icon={<Filter className="h-5 w-5" />}
        title="Sin segmentos definidos"
        description="Cuando crees tu primer segmento (ej. 'VIP > 250€ últimos 12 meses', 'Cart abandoned 24h', 'App users con push reciente'), aparecerá aquí con el tamaño calculado y se podrá usar en cualquier campaña."
        primaryAction={{ label: "Crear segmento (próximamente)", href: "/customers" }}
      />
    </div>
  );
}
