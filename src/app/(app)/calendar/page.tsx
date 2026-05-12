import { Calendar as CalendarIcon, Plus, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import Link from "next/link";

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotional calendar"
        description="Las fechas clave por país. Sendify draftea una campaña N días antes de cada entrada, traduce por mercado y la deja pendiente de aprobación."
        actions={
          <>
            <Button variant="outline" size="sm"><Webhook className="h-3.5 w-3.5" /> Sync source</Button>
            <Button variant="outline" size="sm"><CalendarIcon className="h-3.5 w-3.5" /> 2026</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Nueva promoción</Button>
          </>
        }
      />

      <Card className="bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] border-[color:var(--accent)]/20">
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-card border border-border"><Webhook className="h-3.5 w-3.5 text-[color:var(--accent)]" /></span>
            <div>
              <div className="text-[13px] font-medium">Promotion source</div>
              <div className="text-[11px] text-muted-foreground">Tu proyecto externo de calendario hace push a /api/promotions/webhook · todavía no hay sync configurado</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">Configurar → </Link>
          </Button>
        </CardContent>
      </Card>

      <EmptyState
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Calendario vacío"
        description="Define las promociones globales (San Valentín, Black Friday, Cyber Monday) y regionales (Día de la Madre por país — ES 3 may · FR 25 may · UK 30 mar · US 10 may). Cuando una entrada esté dentro de su lead-time, el auto-drafter genera la campaña automáticamente."
        primaryAction={{ label: "Conectar fuente externa (webhook)", href: "/settings" }}
      />
    </div>
  );
}
