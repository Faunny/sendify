import Link from "next/link";
import { FileText, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";

// Divain starter pack — built from the real Klaviyo campaigns shared on 2026-05-12.
// Each is a real block tree the auto-drafter and builder can load.
const TEMPLATES = [
  { id: "tpl_divain_promo_pct",   name: "Promo · big % discount",        kind: "CAMPAIGN",      thumbnail: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/65d78707-8304-4824-91b2-b23657f4b8dd.jpeg", used: 38, official: true,  desc: "Full-bleed hero · 55% · gold pill CTA · brand pillars · app promo · footer" },
  { id: "tpl_divain_promo_price", name: "Promo · price-led (11,99€)",    kind: "CAMPAIGN",      thumbnail: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600",                                          used: 24, official: true,  desc: "Yellow background · big number price · polaroid product layout · brand pillars" },
  { id: "tpl_divain_app_download",name: "App download · cross-channel",  kind: "CAMPAIGN",      thumbnail: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/3cb2b8b3-eafd-4121-ba02-afbaa01cf10e.jpeg", used: 12, official: true,  desc: "Phone hero · outlined CTA · gold footer with social" },
  { id: "tpl_divain_brand_grid",  name: "Brand showcase · 4 pillars",     kind: "CAMPAIGN",      thumbnail: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600",                                          used:  8, official: true,  desc: "PARFUMS · CARE · HOME · RITUAL split with product photos" },
  { id: "tpl_abandoned_cart",     name: "Abandoned cart · 1 product",     kind: "FLOW",          thumbnail: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600",                                          used: 12_400, desc: "Single product hero · unique discount code · 1h / 24h / 48h cadence" },
  { id: "tpl_welcome",            name: "Welcome · DOI confirm",          kind: "TRANSACTIONAL", thumbnail: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=600",                                          used:  9_120, desc: "Confirmation · welcome discount · brand pillars intro" },
  { id: "tpl_restock",            name: "Restock single product",         kind: "FLOW",          thumbnail: "https://images.unsplash.com/photo-1532009324734-20a7a5813719?w=600",                                          used:  4_320, desc: "Triggered when a customer-favorited SKU comes back in stock" },
  { id: "tpl_vip",                name: "VIP early access",               kind: "CAMPAIGN",      thumbnail: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=600",                                          used:    18, desc: "24h before public launch · top 5% spenders only" },
];

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Templates"
        description="MJML templates ensure pixel-correct rendering across Outlook, Gmail and Apple Mail. Build with the visual editor; export goes to MJML automatically."
        actions={
          <>
            <Button variant="outline" size="sm">Import MJML</Button>
            <Button size="sm" asChild>
              <Link href="/builder"><Palette className="h-3.5 w-3.5" /> Open builder</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <Card key={t.id} className="overflow-hidden hover:border-border/80 transition-colors group">
            <div className="aspect-[4/3] bg-cover bg-center relative" style={{ backgroundImage: `url(${t.thumbnail})` }}>
              {t.official && (
                <div className="absolute top-2 left-2">
                  <Badge variant="accent" className="bg-black/70 text-white border-transparent">divain. starter</Badge>
                </div>
              )}
            </div>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px] font-medium truncate">{t.name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.desc}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Used {t.used.toLocaleString()} times</div>
              </div>
              <Badge variant="muted">{t.kind}</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/builder"><Palette className="h-3.5 w-3.5" /> Edit in builder</Link>
                </Button>
                <Button variant="ghost" size="sm">Duplicate</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
