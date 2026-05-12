import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Performance, deliverability y revenue atribuido a través de las 4 tiendas y los 22 idiomas."
      />
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" />}
        title="Sin datos de performance todavía"
        description="Una vez salga el primer envío, esta página muestra delivered/opened/clicked, CTR, revenue por UTM, tasa de bounce y reputación de cada sender en tiempo real."
        primaryAction={{ label: "Crear primera campaña", href: "/campaigns/new" }}
      />
    </div>
  );
}
