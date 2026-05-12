import { BookOpen, Languages, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/page-header";
import { LANGUAGES } from "@/lib/languages";

const GLOSSARY_PREVIEW = [
  { source: "fragrance",              "es-ES": "fragancia",        "fr-FR": "parfum",        "de-DE": "Duft",         "it-IT": "fragranza",      reviewed: true  },
  { source: "long-lasting",            "es-ES": "larga duración",   "fr-FR": "longue tenue",  "de-DE": "lang anhaltend","it-IT": "lunga durata",    reviewed: true  },
  { source: "high quality dupe",       "es-ES": "equivalencia premium","fr-FR": "équivalence de qualité","de-DE": "Premium-Dupe","it-IT": "equivalenza premium", reviewed: false },
  { source: "free shipping over 30€", "es-ES": "envío gratis +30€","fr-FR": "livraison offerte +30€","de-DE": "Gratisversand ab 30€","it-IT": "spedizione gratuita oltre 30€", reviewed: true  },
  { source: "Divain",                  "es-ES": "Divain",            "fr-FR": "Divain",        "de-DE": "Divain",       "it-IT": "Divain",          reviewed: true  },
];

export default function TranslationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Translations"
        description="DeepL Pro cache + brand glossary. Higher cache hit = lower DeepL spend. Manual overrides take priority over machine output."
        actions={
          <>
            <Button variant="outline" size="sm"><BookOpen className="h-3.5 w-3.5" /> Glossary</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add entry</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cache hit rate · 30d" value="71%" hint="up from 48% last month" tone="positive" />
        <Stat label="Translations cached" value="48,920" hint="across 22 languages" />
        <Stat label="DeepL spend · MTD" value="$342.10" hint="estimated $128 saved by cache" />
        <Stat label="Glossary entries" value="186" hint="brand-curated" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-muted-foreground" /> Coverage by language</CardTitle>
          <CardDescription>How well-cached each market is (higher = cheaper future sends)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANGUAGES.slice(0, 15).map((l, i) => {
            const coverage = 90 - (i * 4 + (i % 3) * 2);
            return (
              <div key={l.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none">{l.flag}</span>
                    {l.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{coverage}%</span>
                </div>
                <Progress value={coverage} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <div className="text-[14px] font-medium">Glossary · divain-brand</div>
            <div className="text-[11px] text-muted-foreground">Brand terms locked across languages</div>
          </div>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search source term…" className="pl-8" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Source (EN)</th>
                <th className="text-left font-medium px-3 py-2.5">🇪🇸 es-ES</th>
                <th className="text-left font-medium px-3 py-2.5">🇫🇷 fr-FR</th>
                <th className="text-left font-medium px-3 py-2.5">🇩🇪 de-DE</th>
                <th className="text-left font-medium px-3 py-2.5">🇮🇹 it-IT</th>
                <th className="text-right font-medium px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY_PREVIEW.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-5 py-2.5 text-[12px] font-medium">{row.source}</td>
                  <td className="px-3 py-2.5 text-[12px]">{row["es-ES"]}</td>
                  <td className="px-3 py-2.5 text-[12px]">{row["fr-FR"]}</td>
                  <td className="px-3 py-2.5 text-[12px]">{row["de-DE"]}</td>
                  <td className="px-3 py-2.5 text-[12px]">{row["it-IT"]}</td>
                  <td className="px-5 py-2.5 text-right">
                    {row.reviewed ? <Badge variant="positive">Reviewed</Badge> : <Badge variant="warning">Auto</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "positive" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[22px] font-medium tabular-nums ${tone === "positive" ? "text-[color:var(--positive)]" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </Card>
  );
}
