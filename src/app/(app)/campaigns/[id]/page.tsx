import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";

// Campaign detail. Renders the full per-language preview + audience + cost breakdown
// once the campaign exists in the DB. Until then we just say "not found" cleanly so a
// stale link from somewhere doesn't 500 the page.
export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
        <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
      </Button>
      <EmptyState
        icon={<FileQuestion className="h-5 w-5" />}
        title="Campaña no encontrada"
        description="Cuando crees campañas y se guarden en la DB, esta vista mostrará el preview por idioma, audiencia resuelta, coste estimado y el monitor de envío en vivo."
        primaryAction={{ label: "Crear campaña", href: "/campaigns/new" }}
        secondaryAction={{ label: "Volver a campañas", href: "/campaigns" }}
      />
    </div>
  );
}
