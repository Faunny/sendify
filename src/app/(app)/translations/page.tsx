import { BookOpen, Languages, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/page-header";
import { LANGUAGES } from "@/lib/languages";

// Translation status. Once the first campaigns are sent, the cache fills up and DeepL spend
// drops. Until then this page shows the 22 enabled languages + the glossary editor.

export default function TranslationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Translations"
        description="DeepL Pro + brand glossary. Cache hit rate más alto = menos gasto en DeepL. Manual overrides ganan sobre la traducción automática."
        actions={
          <>
            <Button variant="outline" size="sm"><BookOpen className="h-3.5 w-3.5" /> Glosario</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Añadir término</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cache hit rate" value="—" hint="se calcula tras el primer envío" />
        <Stat label="Traducciones cacheadas" value="0" hint="aún sin envíos" />
        <Stat label="DeepL spend · MTD" value="$0" hint="se factura por carácter traducido" />
        <Stat label="Glossary entries" value="0" hint="crea el glosario brand para que DeepL respete tu voz" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-muted-foreground" /> Idiomas habilitados</CardTitle>
          <CardDescription>Las 22 lenguas que Sendify puede generar — la cobertura se rellena cuando el cache empieza a llenarse</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANGUAGES.map((l) => (
            <div key={l.code} className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{l.flag}</span>
                  {l.label}
                </span>
                <span className="tabular-nums text-muted-foreground">0%</span>
              </div>
              <Progress value={0} />
            </div>
          ))}
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
