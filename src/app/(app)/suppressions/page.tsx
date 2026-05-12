import { Ban, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function SuppressionsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        meta={<div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldOff className="h-3 w-3" /> Cross-store: una entrada aquí bloquea los 4 senders</div>}
        title="Suppression list"
        description="Emails a los que Sendify nunca enviará. Alimentada por bounces/complaints de SES (via SNS), unsubscribes de clientes (RFC 8058 one-click) y añadidos manuales."
      />

      <EmptyState
        icon={<Ban className="h-5 w-5" />}
        title="Suppression list vacía"
        description="Cuando llegue el primer hard bounce o spam complaint desde AWS SES (vía SNS), o cuando un cliente haga click en unsubscribe, aparecerán aquí. Una entrada aquí afecta a los 4 senders simultáneamente."
        primaryAction={{ label: "Importar lista (próximamente)", href: "/customers" }}
      />
    </div>
  );
}
