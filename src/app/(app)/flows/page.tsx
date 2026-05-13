import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { FlowsClient, type FlowRow, type StoreOption } from "@/components/app/flows-client";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  // Warm the connection so the first list query is fast.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [flows, stores] = await Promise.all([
    prisma.flow.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        store: { select: { slug: true, name: true } },
        _count: { select: { enrollments: true, sends: true } },
      },
    }).catch(() => []),
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    }).catch(() => []),
  ]);

  const rows: FlowRow[] = flows.map((f) => ({
    id: f.id,
    storeId: f.storeId,
    storeSlug: f.store.slug,
    storeName: f.store.name,
    name: f.name,
    trigger: f.trigger,
    active: f.active,
    enrollmentCount: f._count.enrollments,
    sendCount: f._count.sends,
    lastTriggeredAt: f.lastTriggeredAt?.toISOString() ?? null,
    updatedAt: f.updatedAt.toISOString(),
  }));

  const storeOptions: StoreOption[] = stores.map((s) => ({ id: s.id, slug: s.slug, name: s.name }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Flows"
        description="Automatizaciones disparadas por eventos de Shopify: bienvenida, carrito abandonado, post-compra, win-back, cumpleaños. Cada flow es multilingüe end-to-end y se enrola sólo con los webhooks que ya están corriendo."
      />
      <FlowsClient initialFlows={rows} stores={storeOptions} />
    </div>
  );
}
