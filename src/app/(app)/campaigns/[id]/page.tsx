import Link from "next/link";
import { ArrowLeft, Check, Clock, Eye, Languages, Pencil, Send, Users, X, Smartphone, Monitor, Mail, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ApproveButton } from "@/components/app/approve-button";
import { SendingMonitor } from "@/components/app/sending-monitor";
import { CAMPAIGNS, STORES, SENDERS, SEGMENTS } from "@/lib/mock";
import { LANGUAGES, languageByCode } from "@/lib/languages";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { estimateCampaignCost } from "@/lib/cost";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = CAMPAIGNS.find((x) => x.id === id);
  if (!c) return notFound();
  const store = STORES.find((s) => s.id === c.storeId)!;
  const sender = SENDERS.find((s) => s.storeId === c.storeId)!;

  // For demo: pick a sensible set of languages this campaign would fan out to.
  const targetLangs = c.languages > 1
    ? LANGUAGES.slice(0, c.languages)
    : [LANGUAGES.find((l) => l.code === store.defaultLanguage)!];

  const cost = estimateCampaignCost({
    recipients: c.audience,
    languages: c.languages,
    avgCharsPerLanguage: 2200,
    cacheHitRate: 0.71,
    imagesGenerated: 1,
  });

  const segments = SEGMENTS.filter((s) => s.storeId === c.storeId).slice(0, 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="self-start -ml-2 text-muted-foreground">
          <Link href="/campaigns"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
        </Button>
        <PageHeader
          meta={
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono">{c.id}</span>
              <span>·</span>
              <span>{store.name}</span>
            </div>
          }
          title={c.name}
          description={c.subject}
          actions={
            <>
              <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              {c.status === "PENDING_APPROVAL" ? (
                <>
                  <Button variant="outline" size="sm"><X className="h-3.5 w-3.5" /> Request changes</Button>
                  <ApproveButton campaignId={c.id} targetLanguages={targetLangs.map((l) => l.code)} />
                </>
              ) : c.status === "APPROVED" || c.status === "SCHEDULED" ? (
                <ApproveButton campaignId={c.id} targetLanguages={targetLangs.map((l) => l.code)} label="Send now" />
              ) : c.status === "SENDING" ? (
                <Badge variant="accent"><Send className="h-3 w-3" /> Sending live</Badge>
              ) : (
                <Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /> View report</Button>
              )}
            </>
          }
        />
      </div>

      <SendingMonitor campaignId={c.id} initialStatus={c.status} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <Row icon={<Send className="h-3.5 w-3.5" />} label="Status"><StatusBadge status={c.status} /></Row>
            <Row icon={<Clock className="h-3.5 w-3.5" />} label="Scheduled">
              <span className="tabular-nums text-[12px]">{new Date(c.scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
            </Row>
            <Row icon={<Users className="h-3.5 w-3.5" />} label="Audience">
              <span className="tabular-nums text-[12px]">{formatNumber(c.audience)}</span>
            </Row>
            <Row icon={<Languages className="h-3.5 w-3.5" />} label="Languages">
              <div className="flex items-center gap-1">
                {targetLangs.slice(0, 6).map((l) => <span key={l.code} title={l.label} className="text-sm leading-none">{l.flag}</span>)}
                {targetLangs.length > 6 && <span className="text-[10px] text-muted-foreground">+{targetLangs.length - 6}</span>}
              </div>
            </Row>
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="Sender">
              <span className="text-[12px]">{sender.fromEmail}</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
            <CardDescription>Segments included</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {segments.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-card/40 p-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.description}</div>
                </div>
                <span className="text-[12px] tabular-nums">{formatNumber(s.size)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-card/40 p-2.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                Excludes app users with push in last 24h
              </div>
              <Badge variant="muted">~{formatNumber(Math.round(c.audience * 0.18))}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost estimate</CardTitle>
            <CardDescription>Recomputed on each save</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <CostRow label="SES sending" value={formatCurrency(cost.ses)} hint={`${formatNumber(cost.recipients)} × $0.0001`} />
            <CostRow label="DeepL translation" value={formatCurrency(cost.deepl)} hint={`${formatNumber(cost.charsToTranslate)} chars · 71% cache hit`} />
            <CostRow label="Gemini banner" value={formatCurrency(cost.gemini)} hint={`${cost.imagesGenerated} image`} />
            <div className="flex items-center justify-between border-t border-border pt-2.5 mt-2">
              <span className="text-[12px] font-medium">Total</span>
              <span className="text-[14px] font-medium tabular-nums">{formatCurrency(cost.total)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(cost.total / cost.recipients * 1000)} / 1k recipients</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How each language version will render in the inbox</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm"><Monitor className="h-3.5 w-3.5" /> Desktop</Button>
            <Button variant="ghost" size="sm"><Smartphone className="h-3.5 w-3.5" /> Mobile</Button>
            <Button variant="ghost" size="sm"><Zap className="h-3.5 w-3.5" /> Test send</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={targetLangs[0]?.code}>
            <TabsList className="flex-wrap h-auto">
              {targetLangs.map((l) => (
                <TabsTrigger key={l.code} value={l.code}>
                  <span className="mr-1.5">{l.flag}</span>
                  {l.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {targetLangs.map((l) => (
              <TabsContent key={l.code} value={l.code}>
                <EmailPreview language={l.code} subject={c.subject} senderName={sender.fromName} senderEmail={sender.fromEmail} storeName={store.name} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      {children}
    </div>
  );
}

function CostRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

// Visual email preview. Translates the subject/hero text per locale for the demo;
// in production this consumes the rendered CampaignVariant.htmlSnapshot.
const PREVIEWS: Record<string, { greeting: string; hero: string; sub: string; cta: string; footer: string }> = {
  "es-ES": { greeting: "Hola Lucía,", hero: "Para ella, lo que de verdad le emociona", sub: "Una selección de fragancias hechas para emocionar este Día de la Madre.", cta: "Descubrir colección", footer: "Si no quieres recibir más correos, " },
  "es-MX": { greeting: "Hola Lucía,", hero: "Para ella, lo que en verdad la emociona", sub: "Una selección de fragancias hechas para emocionar este Día de las Madres.", cta: "Descubrir colección", footer: "Si no deseas recibir más correos, " },
  "en-GB": { greeting: "Hi Lucia,", hero: "The fragrance she'll actually wear", sub: "A curated edit of scents she'll fall for this Mother's Day.", cta: "Shop the edit", footer: "Don't want these emails? " },
  "en-US": { greeting: "Hi Lucia,", hero: "The fragrance she'll actually wear", sub: "A curated edit of scents she'll fall for this Mother's Day.", cta: "Shop the edit", footer: "Don't want these emails? " },
  "fr-FR": { greeting: "Bonjour Lucie,", hero: "Pour elle, un parfum qui lui ressemble", sub: "Une sélection de parfums pensés pour la Fête des Mères.", cta: "Découvrir la collection", footer: "Pour ne plus recevoir ces e-mails, " },
  "de-DE": { greeting: "Hallo Lucia,", hero: "Für sie. Ein Duft, der bleibt.", sub: "Eine handverlesene Auswahl zum Muttertag.", cta: "Kollektion entdecken", footer: "Wenn Sie diese E-Mails nicht mehr erhalten möchten, " },
  "it-IT": { greeting: "Ciao Lucia,", hero: "Per lei, un profumo che la rappresenta", sub: "Una selezione di fragranze pensate per la Festa della Mamma.", cta: "Scopri la collezione", footer: "Per non ricevere più queste e-mail, " },
  "pt-PT": { greeting: "Olá Lúcia,", hero: "Para ela, uma fragrância que a representa", sub: "Uma seleção de perfumes pensados para o Dia da Mãe.", cta: "Descobrir a coleção", footer: "Se não quiser receber mais e-mails, " },
};

function EmailPreview({ language, subject, senderName, senderEmail, storeName }: { language: string; subject: string; senderName: string; senderEmail: string; storeName: string }) {
  const t = PREVIEWS[language] ?? PREVIEWS["en-GB"];
  const lang = languageByCode(language);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold-700)] grid place-items-center text-[10px] text-[var(--accent-fg)] font-medium">DP</div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium truncate">{senderName} <span className="text-muted-foreground font-normal">&lt;{senderEmail}&gt;</span></div>
              <div className="text-[11px] text-muted-foreground truncate">{subject}</div>
            </div>
          </div>
          <Badge variant="muted">{lang?.flag} {lang?.nativeLabel}</Badge>
        </div>
      </div>
      <div className="bg-[#FBF8F3] text-[#1a1a1a]">
        <div className="max-w-[600px] mx-auto py-8 px-6">
          <div className="text-center mb-6">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#888]">{storeName}</div>
          </div>
          <div className="aspect-[3/2] w-full overflow-hidden rounded-md mb-6 bg-gradient-to-br from-[#D4AF7A]/30 via-[#FBF8F3] to-[#EBD3A1]/40 grid place-items-center">
            <div className="text-[#6E5523] text-center">
              <div className="font-serif italic text-2xl">{t.hero}</div>
            </div>
          </div>
          <p className="text-[14px] mb-3">{t.greeting}</p>
          <p className="text-[14px] leading-relaxed mb-5">{t.sub}</p>
          <div className="text-center mb-6">
            <a className="inline-block bg-[#0E0E0E] text-white text-[12px] tracking-wider uppercase px-7 py-3 rounded-sm font-medium">
              {t.cta}
            </a>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1,2,3].map((i) => (
              <div key={i} className="aspect-square bg-white border border-[#eee] grid place-items-center text-[10px] text-[#888]">Product {i}</div>
            ))}
          </div>
          <div className="border-t border-[#eee] pt-4 text-center text-[10px] text-[#888]">
            {t.footer}<a className="underline" href="#">unsubscribe</a>
          </div>
        </div>
      </div>
    </div>
  );
}
