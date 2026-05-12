import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function CampaignsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description="Drafts, scheduled and sent campaigns across all stores. Send only after approval; translation runs automatically per recipient language."
        actions={
          <Button size="sm" asChild>
            <Link href="/campaigns/new"><Plus className="h-3.5 w-3.5" /> New campaign</Link>
          </Button>
        }
      />

      <EmptyState
        icon={<Mail className="h-5 w-5" />}
        title="Sin campañas todavía"
        description="Cuando crees tu primera campaña aparecerá aquí. También puedes dejar que el auto-drafter genere una desde el calendario de promociones."
        primaryAction={{ label: "Crear campaña", href: "/campaigns/new" }}
        secondaryAction={{ label: "Ver calendario", href: "/calendar" }}
      />
    </div>
  );
}
