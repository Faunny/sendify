import Link from "next/link";
import { Palette, Sparkles, FileText, Clock, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { AiTemplateGenerator } from "@/components/app/ai-template-generator";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [templates, stores] = await Promise.all([
    prisma.template.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, kind: true, updatedAt: true, storeId: true, store: { select: { name: true, slug: true } } },
    }).catch(() => []),
    prisma.store.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Templates"
        description="Plantillas MJML para renderizado pixel-correcto en Outlook, Gmail, Apple Mail. Genera con IA, edita en el builder, traduce a 22 idiomas automáticamente."
        actions={
          <div className="flex items-center gap-2">
            <AiTemplateGenerator stores={stores} />
            <Button size="sm" variant="outline" asChild>
              <Link href="/builder"><Palette className="h-3.5 w-3.5" /> Abrir builder</Link>
            </Button>
          </div>
        }
      />

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--accent)]/10">
              <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
            </div>
            <div>
              <div className="text-[15px] font-medium">Empieza con una generación IA</div>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-md">
                Describe un email (evento, audiencia, oferta, tono) y DeepSeek genera el MJML completo con la paleta + tipografía + footer de divain.
                Tarda ~12s, cuesta ~$0.003.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <AiTemplateGenerator stores={stores} />
              <Button variant="outline" size="sm" asChild>
                <Link href="/builder"><Edit3 className="h-3.5 w-3.5" /> Empezar desde cero</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="hover:border-[color:var(--accent)]/50 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="muted" className="text-[10px]">{t.kind}</Badge>
                      {t.store && <Badge variant="muted" className="text-[10px]">{t.store.name}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {new Date(t.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="text-[12px]" asChild>
                    <Link href={`/builder?templateId=${t.id}`}><Edit3 className="h-3 w-3" /> Editar</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
