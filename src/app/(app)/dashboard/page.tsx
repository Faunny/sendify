import Link from "next/link";
import { Calendar, Mail, Plug, Sparkles, ShoppingBag, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { EmptyState } from "@/components/app/empty-state";
import { STORES, SENDERS } from "@/lib/mock";

// Dashboard. Until the database is connected and data starts flowing in from Shopify +
// the import script, every panel is intentionally empty. Once the SetupChecklist below is
// green, the same panels will populate from prisma queries — no further code changes.

export default async function DashboardPage() {
  const senderVerified = SENDERS.filter((s) => s.verified).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Cuatro tiendas divain (Europa · UK · USA+Canada · México) bajo el mismo brand, conectadas al pipeline de envío vía Amazon SES."
        actions={
          <Button size="sm" asChild>
            <Link href="/campaigns/new"><Sparkles className="h-3.5 w-3.5" /> New campaign</Link>
          </Button>
        }
      />

      <SetupChecklist />

      {/* Static stores summary — these 4 are real config, not mock data */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Stores configured</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STORES.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{s.legal.legalName}</div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{s.currency}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <div className="uppercase tracking-wider text-muted-foreground">Customers</div>
                  <div className="tabular-nums text-foreground">—</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-muted-foreground">Products</div>
                  <div className="tabular-nums text-foreground">—</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Senders summary */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Sender identities</div>
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {SENDERS.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium">{s.fromEmail}</div>
                    <div className="text-[10px] text-muted-foreground">{s.fromName} · daily cap {s.dailyCap.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider ${s.verified ? "text-[color:var(--positive)]" : "text-[color:var(--warning)]"}`}>
                    {s.verified ? "Verified" : "Pending verification"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        {senderVerified < SENDERS.length && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Verifica DKIM/SPF/DMARC en cada dominio dentro de AWS SES. Hasta entonces, los envíos no salen.
          </p>
        )}
      </div>

      {/* Empty performance section */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Performance · last 30 days</div>
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title="Sin envíos todavía"
          description="Cuando apruebes la primera campaña y se procese por el worker, este panel mostrará envíos, opens, clicks y revenue atribuido en tiempo real."
          primaryAction={{ label: "Crear primera campaña", href: "/campaigns/new" }}
          secondaryAction={{ label: "Ver calendario", href: "/calendar" }}
        />
      </div>

      {/* Quick next steps */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Próximos pasos</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NextStep icon={Plug}       title="Conectar Shopify"     hint="Sincroniza customers, products, orders en tiempo real"             href="/settings" />
          <NextStep icon={Upload}     title="Importar de Klaviyo"   hint="Bulk CSV de tus 1.5M clientes existentes a Sendify"               href="/import" />
          <NextStep icon={Calendar}   title="Calendario promo"      hint="Configura las fechas por país (Día de la Madre, BFCM, etc.)"     href="/calendar" />
          <NextStep icon={ShoppingBag}title="Catálogo"              hint="Productos sincronizados desde Shopify con precios por mercado"   href="/products" />
        </div>
      </div>
    </div>
  );
}

function NextStep({ icon: Icon, title, hint, href }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="p-4 hover:border-[color:var(--accent)]/40 transition-colors h-full">
        <div className="flex items-start gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-secondary text-muted-foreground shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium">{title}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
