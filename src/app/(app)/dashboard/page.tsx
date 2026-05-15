import Link from "next/link";
import { Calendar, Mail, Plug, Sparkles, ShoppingBag, Upload, Inbox, Workflow, Users, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { EmptyState } from "@/components/app/empty-state";
import { prisma } from "@/lib/db";

// Dashboard. Reads everything from Prisma — no mock data anywhere. The
// SetupChecklist component handles its own queries; this page is just the
// "what's the current state of my account" overview.

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Warm Neon so the first paint isn't a 600ms cold start.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [stores, senders, customersTotal, productsTotal, pendingApproval, activeFlows, sendsLast30d] = await Promise.all([
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true, slug: true, name: true, currency: true,
        legalName: true, productCount: true,
        _count: { select: { customers: true } },
      },
    }).catch(() => []),
    prisma.sender.findMany({
      where: { active: true },
      orderBy: { fromEmail: "asc" },
      select: { id: true, fromEmail: true, fromName: true, verified: true, dailyCap: true },
    }).catch(() => []),
    prisma.customer.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.product.count().catch(() => 0),
    prisma.campaign.count({ where: { status: "PENDING_APPROVAL" } }).catch(() => 0),
    prisma.flow.count({ where: { active: true } }).catch(() => 0),
    prisma.send.count({
      where: { sentAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }).catch(() => 0),
  ]);

  const senderVerified = senders.filter((s) => s.verified).length;

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

      {/* Quick stats row — every number is live from Prisma */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatLink href="/approvals"  icon={<Inbox className="h-4 w-4" />}    label="Pending approval" value={pendingApproval} hint={pendingApproval > 0 ? "tu revisión" : "vacío"} />
        <StatLink href="/flows"      icon={<Workflow className="h-4 w-4" />} label="Active flows"     value={activeFlows}     hint={activeFlows > 0 ? "corriendo" : "configurar"} />
        <StatLink href="/customers"  icon={<Users className="h-4 w-4" />}    label="Customers"        value={customersTotal}  hint="sincronizados" />
        <StatLink href="/reports"    icon={<Send className="h-4 w-4" />}     label="Sends · 30 días"  value={sendsLast30d}    hint="incluye fallidos" />
      </div>

      {/* Real stores from DB */}
      {stores.length > 0 ? (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Stores configured · {stores.length}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stores.map((s) => (
              <Link key={s.id} href={`/settings`} className="block">
                <Card className="p-4 hover:border-foreground/40 transition-colors h-full">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{s.legalName ?? s.slug}</div>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{s.currency}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="uppercase tracking-wider text-muted-foreground">Customers</div>
                      <div className="tabular-nums text-foreground">{s._count.customers.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-muted-foreground">Products</div>
                      <div className="tabular-nums text-foreground">{(s.productCount ?? 0).toLocaleString()}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Plug className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-[14px] font-medium">Sin tiendas conectadas</div>
            <div className="text-[12px] text-muted-foreground mt-1">Añade tus 4 tiendas Shopify en Settings para empezar.</div>
            <Button size="sm" asChild className="mt-3">
              <Link href="/settings">Conectar primera tienda</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Senders from DB */}
      {senders.length > 0 && (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
            Sender identities · {senderVerified}/{senders.length} verified
          </div>
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-border">
              {senders.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{s.fromEmail}</div>
                      <div className="text-[11px] text-muted-foreground">{s.fromName} · daily cap {s.dailyCap.toLocaleString()}</div>
                    </div>
                  </div>
                  <span className={`text-[11px] uppercase tracking-wider ${s.verified ? "text-[color:var(--positive)]" : "text-[color:var(--warning)]"}`}>
                    {s.verified ? "Verified" : "Pending verification"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {senderVerified < senders.length && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Verifica DKIM/SPF/DMARC en cada dominio dentro de AWS SES. Hasta entonces los envíos no salen.
            </p>
          )}
        </div>
      )}

      {/* Performance — empty until first send */}
      {sendsLast30d === 0 && (
        <div>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">Performance · last 30 days</div>
          <EmptyState
            icon={<Mail className="h-5 w-5" />}
            title="Sin envíos todavía"
            description="Cuando apruebes la primera campaña y se procese por el worker, este panel mostrará envíos, opens, clicks y revenue atribuido en tiempo real."
            primaryAction={{ label: "Crear primera campaña", href: "/campaigns/new" }}
            secondaryAction={{ label: "Ver calendario", href: "/calendar" }}
          />
        </div>
      )}

      {/* Quick next steps */}
      <div>
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">Próximos pasos</div>
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

function StatLink({ href, icon, label, value, hint }: { href: string; icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <Link href={href} className="block">
      <Card className="p-4 hover:border-foreground/40 transition-colors h-full">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {icon}{label}
        </div>
        <div className="text-[28px] font-light tabular-nums mt-1">{value.toLocaleString()}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      </Card>
    </Link>
  );
}

function NextStep({ icon: Icon, title, hint, href }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="p-4 hover:border-foreground/40 transition-colors h-full">
        <div className="flex items-start gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-secondary text-muted-foreground shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
