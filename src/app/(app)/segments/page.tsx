import Link from "next/link";
import { Filter, Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { SEGMENTS, STORES } from "@/lib/mock";
import { formatNumber } from "@/lib/utils";

export default function SegmentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Segments"
        description="Behavior-based segments compiled to SQL. Auto-refresh every 6h; manual recompute on click."
        actions={
          <>
            <Button variant="outline" size="sm"><Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> AI-suggest segment</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New segment</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SEGMENTS.map((s) => {
          const store = STORES.find((x) => x.id === s.storeId)!;
          return (
            <Card key={s.id} className="hover:border-border/80 transition-colors group">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-[14px]">{s.name}</CardTitle>
                  <Badge variant="muted">{store.name.replace("Divain ", "")}</Badge>
                </div>
                <CardDescription className="line-clamp-2">{s.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Audience</div>
                    <div className="text-[22px] font-medium tracking-tight tabular-nums flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {formatNumber(s.size)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/segments/${s.id}`}>Edit</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
