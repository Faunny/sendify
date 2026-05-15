import { Ban, ShieldOff, Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuppressionsPage() {
  await prisma.$queryRaw`SELECT 1`.catch(() => {});
  const [rows, total] = await Promise.all([
    prisma.suppression.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }).catch(() => []),
    prisma.suppression.count().catch(() => 0),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        meta={<div className="flex items-center gap-2 text-[12px] text-muted-foreground"><ShieldOff className="h-3 w-3" /> Cross-store: una entrada aquí bloquea los 4 senders</div>}
        title="Suppression list"
        description={total === 0
          ? "Emails a los que Sendify nunca enviará. Alimentada por bounces/complaints de SES (via SNS), unsubscribes de clientes (RFC 8058 one-click) y añadidos manuales."
          : `${total.toLocaleString()} email${total === 1 ? "" : "s"} bloqueado${total === 1 ? "" : "s"}. Una entrada aquí afecta a los 4 senders simultáneamente.`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Ban className="h-5 w-5" />}
          title="Suppression list vacía"
          description="Cuando llegue el primer hard bounce o spam complaint desde AWS SES (vía SNS), o cuando un cliente haga click en unsubscribe, aparecerán aquí. Una entrada aquí afecta a los 4 senders simultáneamente."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((s) => (
              <li key={s.email} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-mono truncate">{s.email}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      añadido {new Date(s.createdAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                </div>
                <Badge variant="muted" className="text-[11px] shrink-0">
                  {s.reason ?? "manual"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
