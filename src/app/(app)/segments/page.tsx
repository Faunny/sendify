import Link from "next/link";
import { Filter, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { SEGMENT_PRESETS } from "@/lib/segment-presets";

export default async function SegmentsPage() {
  const stores = await prisma.store.findMany({ orderBy: { slug: "asc" } }).catch(() => []);
  const segments = await prisma.segment.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { store: { select: { name: true } } },
  }).catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Segments"
        description="Segmentos basados en comportamiento, compilados a SQL contra el Customer table. Recompute con un click — el tamaño se recalcula sobre los datos actuales."
        actions={
          <Button size="sm" asChild>
            <Link href="/segments/new"><Plus className="h-3.5 w-3.5" /> Nuevo desde cero</Link>
          </Button>
        }
      />

      {/* User-created segments */}
      {segments.length > 0 ? (
        <section>
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">Tus segmentos · {segments.length}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {segments.map((s) => (
              <Card key={s.id} className="hover:border-border/80 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-[14px]">{s.name}</CardTitle>
                    {s.store && <Badge variant="muted">{s.store.name.replace("divain · ", "")}</Badge>}
                  </div>
                  {s.description && <CardDescription className="line-clamp-2">{s.description}</CardDescription>}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Audience</div>
                      <div className="text-[22px] font-medium tabular-nums flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {formatNumber(s.estimatedSize)}
                      </div>
                      {s.lastEvaluatedAt && <div className="text-[11px] text-muted-foreground">recompute {new Date(s.lastEvaluatedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</div>}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/segments/${s.id}`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Filter className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <div className="text-[14px] font-medium">Aún no has creado segmentos</div>
            <div className="text-[12px] text-muted-foreground mt-1">Clona uno de los presets de abajo o construye uno desde cero. El tamaño se calcula contra los clientes reales en Postgres.</div>
          </CardContent>
        </Card>
      )}

      {/* Preset library */}
      <section>
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">Presets · clona y ajusta</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SEGMENT_PRESETS.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{p.emoji}</span>
                  <CardTitle className="text-[14px]">{p.name}</CardTitle>
                </div>
                <CardDescription className="line-clamp-3">{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-mono">{p.id}</span>
                <form action="/api/segments/clone" method="POST">
                  <input type="hidden" name="presetId" value={p.id} />
                  {stores.length > 0 && (
                    <select name="storeId" className="hidden">
                      <option value={stores[0].id}>{stores[0].id}</option>
                    </select>
                  )}
                  <Button size="sm" variant="outline" type="submit">Clonar</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
