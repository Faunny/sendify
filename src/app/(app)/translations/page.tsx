import { Languages } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/page-header";
import { LANGUAGES } from "@/lib/languages";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Translation status — reads real cache counts from prisma.translation (the
// DeepL/LLM cache table). Glossary editor is a follow-up; until it ships the
// page is read-only.

export default async function TranslationsPage() {
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [totalCached, perLang, glossaryCount] = await Promise.all([
    prisma.translation.count().catch(() => 0),
    prisma.translation.groupBy({
      by: ["targetLang"],
      _count: { _all: true },
    }).catch(() => [] as Array<{ targetLang: string; _count: { _all: number } }>),
    prisma.glossary.count().catch(() => 0),
  ]);

  const countByLang = Object.fromEntries(perLang.map((r) => [r.targetLang, r._count._all]));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Translations"
        description="Cache de traducciones (DeepL / LLM). Cuantas más traducciones cacheadas, menos gasto por envío. Las overrides manuales ganan sobre la auto-traducción."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Traducciones cacheadas" value={totalCached.toLocaleString()} hint="acumulado total" />
        <Stat label="Idiomas con cache" value={`${perLang.length} / ${LANGUAGES.length}`} hint="con al menos 1 entrada" />
        <Stat label="Glossary entries" value={glossaryCount.toLocaleString()} hint="glosarios para preservar voz brand" />
        <Stat label="Provider activo" value="DeepSeek + DeepL" hint="LLM + DeepL Pro como fallback" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-muted-foreground" /> Idiomas habilitados</CardTitle>
          <CardDescription>Las 22 lenguas que Sendify puede generar — la cobertura se rellena cuando el cache empieza a llenarse</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANGUAGES.map((l) => {
            const cached = countByLang[l.code] ?? 0;
            // Coverage = how much of typical demand is cached. Heuristic: 100
            // entries = "complete enough", anything above is gravy.
            const coverage = Math.min(100, Math.round((cached / 100) * 100));
            return (
              <div key={l.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none">{l.flag}</span>
                    {l.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{cached.toLocaleString()}</span>
                </div>
                <Progress value={coverage} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-medium tabular-nums text-muted-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </Card>
  );
}
