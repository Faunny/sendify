import Link from "next/link";
import { ClipboardList, Eye, MousePointer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type FormCardProps = {
  form: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    status: string;
    impressions: number;
    submissions: number;
    updatedAt: Date;
    store: { name: string; slug: string } | null;
  };
};

export function FormCard({ form }: FormCardProps) {
  const conv = form.impressions > 0 ? (form.submissions / form.impressions) * 100 : 0;

  return (
    <Card className="hover:border-[color:var(--accent)]/50 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <Link href={`/forms/${form.slug}`} className="text-[14px] font-medium hover:underline truncate block">{form.name}</Link>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="muted" className="text-[11px]">{form.kind}</Badge>
                {form.store && <Badge variant="muted" className="text-[11px]">{form.store.name}</Badge>}
                <Badge variant={form.status === "PUBLISHED" ? "positive" : "muted"} className="text-[11px]">
                  {form.status === "PUBLISHED" ? "Publicado" : form.status === "DRAFT" ? "Draft" : form.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Impresiones" value={form.impressions.toLocaleString()} icon={<Eye className="h-3 w-3" />} />
          <Stat label="Submissions" value={form.submissions.toLocaleString()} icon={<MousePointer className="h-3 w-3" />} />
          <Stat label="Conversión" value={`${conv.toFixed(1)}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-[14px] font-medium tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
