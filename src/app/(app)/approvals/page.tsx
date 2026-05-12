import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function ApprovalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="Cualquier draft que cree el calendario, el builder con AI, o un sistema externo, aterriza aquí. Apruebas la campaña madre y se liberan los envíos en todos los idiomas."
      />
      <EmptyState
        icon={<Inbox className="h-5 w-5" />}
        title="Sin nada pendiente"
        description="Cuando una promoción del calendario entre en su ventana de lead-time o cuando crees una campaña a mano, aparecerá aquí para que la apruebes antes de que salga."
        primaryAction={{ label: "Ver calendario", href: "/calendar" }}
        secondaryAction={{ label: "Crear campaña a mano", href: "/campaigns/new" }}
      />
    </div>
  );
}
