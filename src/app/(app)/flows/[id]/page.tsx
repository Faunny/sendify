import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { FlowDetailClient } from "@/components/app/flow-detail-client";
import type { FlowGraph } from "@/lib/flows/presets";

export const dynamic = "force-dynamic";

export default async function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const flow = await prisma.flow.findUnique({
    where: { id },
    include: {
      store: { select: { slug: true, name: true } },
      _count: { select: { enrollments: true, sends: true } },
    },
  });

  if (!flow) notFound();

  const sendCounts = await prisma.send.groupBy({
    by: ["status"],
    where: { flowId: id },
    _count: { _all: true },
  }).catch(() => []);

  const sentByStatus = Object.fromEntries(sendCounts.map((r) => [r.status, r._count._all]));
  const enrollmentStats = await prisma.flowEnrollment.groupBy({
    by: ["status"],
    where: { flowId: id },
    _count: { _all: true },
  }).catch(() => []);
  const enrollByStatus = Object.fromEntries(enrollmentStats.map((r) => [r.status, r._count._all]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/flows" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a flows
        </Link>
      </div>
      <PageHeader
        title={flow.name}
        description={`Trigger: ${flow.trigger} · Store: ${flow.store.name} · Última activación: ${flow.lastTriggeredAt ? new Date(flow.lastTriggeredAt).toLocaleString("es-ES") : "nunca"}`}
      />

      <FlowDetailClient
        flow={{
          id: flow.id,
          name: flow.name,
          active: flow.active,
          trigger: flow.trigger,
          storeName: flow.store.name,
          graph: flow.graph as unknown as FlowGraph,
          stats: {
            enrolledTotal:    flow._count.enrollments,
            sendsTotal:       flow._count.sends,
            sentSucceeded:    sentByStatus.SENT ?? 0,
            sentDelivered:    sentByStatus.DELIVERED ?? 0,
            sentOpened:       sentByStatus.OPENED ?? 0,
            sentClicked:      sentByStatus.CLICKED ?? 0,
            sentFailed:       sentByStatus.FAILED ?? 0,
            enrolledActive:    enrollByStatus.ACTIVE ?? 0,
            enrolledCompleted: enrollByStatus.COMPLETED ?? 0,
            enrolledCancelled: enrollByStatus.CANCELLED ?? 0,
            enrolledFailed:    enrollByStatus.FAILED ?? 0,
          },
        }}
      />
    </div>
  );
}
