import Link from "next/link";
import { FileText, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Templates"
        description="Plantillas MJML para renderizado pixel-correcto en Outlook, Gmail, Apple Mail. Construye con el builder visual; exporta a MJML automáticamente."
        actions={
          <Button size="sm" asChild>
            <Link href="/builder"><Palette className="h-3.5 w-3.5" /> Abrir builder</Link>
          </Button>
        }
      />

      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="Sin plantillas guardadas"
        description="Diseña en el builder y guarda como template para reutilizar entre campañas. El footer legal se inyecta automáticamente desde la sociedad de cada tienda — no hay que duplicarlo por idioma."
        primaryAction={{ label: "Abrir builder", href: "/builder" }}
        secondaryAction={{ label: "Importar MJML (próximamente)", href: "/builder" }}
      />
    </div>
  );
}
