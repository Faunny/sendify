"use client";

import Link from "next/link";
import { Building2, Check, ChevronRight, ExternalLink, Key, Languages, Mail, Plug, Plus, ShieldCheck, Users, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/page-header";
import { WarmupProgress } from "@/components/app/warmup-progress";
import { SENDERS, STORES } from "@/lib/mock";
import { LANGUAGES } from "@/lib/languages";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" description="Senders, stores, integrations, languages and team." />

      <Tabs defaultValue="senders">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="senders"><Mail className="h-3.5 w-3.5" /> Senders</TabsTrigger>
          <TabsTrigger value="stores"><Building2 className="h-3.5 w-3.5" /> Stores</TabsTrigger>
          <TabsTrigger value="languages"><Languages className="h-3.5 w-3.5" /> Languages</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="h-3.5 w-3.5" /> Integrations</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3.5 w-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="api"><Key className="h-3.5 w-3.5" /> API</TabsTrigger>
          <TabsTrigger value="compliance"><ShieldCheck className="h-3.5 w-3.5" /> Compliance</TabsTrigger>
        </TabsList>

        {/* ─── Senders ─── */}
        <TabsContent value="senders">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">SES verified domains and email identities. DKIM, SPF and DMARC checked nightly.</p>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add sender</Button>
          </div>
          <div className="grid gap-3">
            {SENDERS.map((s) => {
              const store = STORES.find((x) => x.id === s.storeId)!;
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13px]">{s.fromEmail}</span>
                          {s.verified ? <Badge variant="positive">Verified</Badge> : <Badge variant="danger">Unverified</Badge>}
                          <Badge variant="muted">{s.provider}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{s.fromName} · {store.name}</div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> DKIM</span>
                          <span className="inline-flex items-center gap-1"><Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> SPF</span>
                          <span className="inline-flex items-center gap-1">{s.verified ? <Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> : <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] inline-block" />} DMARC</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">Daily cap</div>
                        <div className="text-[13px] tabular-nums">{s.dailyCap.toLocaleString()}</div>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                    <WarmupProgress sender={s} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Stores ─── */}
        <TabsContent value="stores">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Shopify Plus stores, legal entities and brand kit. Webhooks auto-installed.</p>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Connect store</Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {STORES.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {s.name}
                  </CardTitle>
                  <CardDescription>{s.shopifyDomain} → {s.storefrontUrl.replace(/^https?:\/\//, "")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Country" value={s.countryCode} />
                    <Mini label="Default lang" value={s.defaultLanguage} />
                    <Mini label="Currency" value={s.currency} />
                    <Mini label="Products" value={s.productCount.toLocaleString()} />
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Markets sold into</div>
                    <div className="flex flex-wrap gap-1">
                      {s.markets.map((m) => <Badge key={m} variant="muted" className="text-[10px]">{m}</Badge>)}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Product pillars</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="muted" className="text-[10px]">divain. PARFUMS</Badge>
                      <Badge variant="muted" className="text-[10px]">divain. CARE</Badge>
                      <Badge variant="muted" className="text-[10px]">divain. HOME</Badge>
                      <Badge variant="muted" className="text-[10px]">divain. RITUAL</Badge>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Legal entity (footer)</div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">Edit</Button>
                    </div>
                    <div className="text-[12px] font-medium">{s.legal.legalName}</div>
                    <div className="text-[11px] text-muted-foreground">{s.legal.vatNumber}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{s.legal.address}, {s.legal.postalCode} {s.legal.city}, {s.legal.country}</div>
                    <div className="text-[11px] text-muted-foreground">{s.legal.supportEmail} · {s.legal.supportPhone}</div>
                    <div className="flex gap-2 mt-1.5 text-[10px]">
                      <a className="text-[color:var(--accent)] hover:underline">Privacy</a>
                      <a className="text-[color:var(--accent)] hover:underline">Terms</a>
                      <a className="text-[color:var(--accent)] hover:underline">Cookies</a>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Brand kit</div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" asChild>
                        <Link href="/settings/brand">Customize →</Link>
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md bg-cover bg-center border border-border" style={{ backgroundImage: `url(${s.brand.logoUrl})` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-muted-foreground mb-1">Palette</div>
                        <div className="flex items-center gap-1">
                          {Object.entries(s.brand.palette).map(([k, v]) => (
                            <div key={k} title={`${k} · ${v}`} className="h-5 w-5 rounded-sm border border-border" style={{ background: v }} />
                          ))}
                        </div>
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          {s.brand.fontHeading} · {s.brand.fontBody}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Languages ─── */}
        <TabsContent value="languages">
          <p className="text-sm text-muted-foreground mb-3">{LANGUAGES.length} languages enabled. Each maps to a DeepL target code.</p>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {LANGUAGES.map((l) => (
                  <li key={l.code} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{l.flag}</span>
                      <div>
                        <div className="text-[13px] font-medium">{l.label}</div>
                        <div className="text-[10px] text-muted-foreground">{l.nativeLabel} · BCP-47 {l.code} · DeepL {l.deeplCode} · {l.countries.length} country{l.countries.length > 1 ? "ies" : ""}</div>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Integrations ─── */}
        <TabsContent value="integrations">
          <Card className="mb-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Webhook className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Promotion source</CardTitle>
              <CardDescription>Your upstream calendar tool pushes promotion upserts here. Sendify mirrors them and auto-drafts a campaign N days before each date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="rounded-md border border-border bg-card/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Webhook URL</div>
                <div className="font-mono text-[12px] flex items-center justify-between gap-2">
                  <span className="truncate">https://sendify.divain.space/api/promotions/webhook</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">Copy</Button>
                </div>
              </div>
              <div className="rounded-md border border-border bg-card/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Signing secret (HMAC-SHA256)</div>
                <div className="font-mono text-[12px] flex items-center justify-between gap-2">
                  <span>whsec_••••_t9aK</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">Rotate</Button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Your sender computes <code>hex(hmac_sha256(secret, raw_body))</code> and sends it in <code>X-Sendify-Signature: sha256=…</code>.
                </div>
              </div>
              <div className="rounded-md border border-border bg-card/40 p-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent deliveries</div>
                <Delivery time="2 min ago" status="200" event="upsert" id="promo_2026_madres_es" />
                <Delivery time="4 min ago" status="200" event="upsert" id="promo_2026_madres_fr" />
                <Delivery time="11 min ago" status="200" event="upsert" id="promo_2026_padres_es" />
                <Delivery time="1 h ago" status="401" event="upsert" id="promo_test_payload" failed />
              </div>
              <details className="rounded-md border border-border bg-card/40 p-3 group">
                <summary className="text-[12px] font-medium cursor-pointer flex items-center justify-between">
                  Example payload your project should POST
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                </summary>
                <pre className="mt-3 text-[10px] font-mono bg-[color:var(--bg)] border border-border rounded p-3 overflow-x-auto leading-relaxed">
{`POST /api/promotions/webhook
Content-Type: application/json
X-Sendify-Signature: sha256=<hmac>

{
  "externalId":     "promo_2026_madres_es",
  "externalSource": "marketing-calendar",
  "action":         "upsert",
  "name":           "Día de la Madre",
  "kind":           "REGIONAL",
  "storeId":        "st_1",
  "dateByCountry":  { "ES": "2026-05-03", "PT": "2026-05-03" },
  "autoDraft":      true,
  "leadDays":       14,
  "defaultSegmentIds": ["sg_1"],
  "bannerPrompt":   "Mother's Day · luxury minimal · warm gold and ivory · no text",
  "briefForLlm":    "Focus on top 3 women's florals. Tone warm, refined."
}`}
                </pre>
              </details>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Integration
              name="Amazon SES"
              hint="eu-west-1 · 670k/day requested"
              status="action"
              detail="Verifica los 4 dominios sender (divainparfums.com / .co.uk / .co / .mx) en AWS SES y configura el SNS topic para bounces/complaints"
            />
            <Integration
              name="Shopify Plus (×4)"
              hint="GraphQL Admin API · webhooks pendientes"
              status="action"
              detail="Conecta cada tienda Shopify Plus para sincronizar customers/orders/products en tiempo real. Webhooks: customers/update · orders/create · checkouts/update · products/update"
            />
            <Integration
              name="DeepL Pro"
              hint="Translation engine"
              status="action"
              detail="Necesita DEEPL_API_KEY. Crea glossary divain-brand para que respete tus términos en los 22 idiomas."
            />
            <Integration
              name="Google Gemini 2.5 Flash Image"
              hint="Aka Nano Banana — el motor de IA que genera los banners"
              status="action"
              detail="Saca tu API key gratis en aistudio.google.com/apikey y pégala como GEMINI_API_KEY en Vercel. $0.04 por imagen, paleta de marca inyectada automáticamente."
            />
            <Integration
              name="Google Ads"
              hint="Customer Match · audience read/write"
              status="action"
              detail="Refresh token expires in 4 days. Reauthorize."
            />
            <Integration
              name="OpenAI"
              hint="GPT-4 commercial copy review (opcional)"
              status="disconnected"
              detail="Si añades OPENAI_API_KEY, GPT-4 revisa el copy comercial post-DeepL para ajustar tono y claims antes de enviar."
            />
            <Integration
              name="S3 + CloudFront"
              hint="Asset CDN"
              status="action"
              detail="Provisiona el bucket sendify-assets y el CloudFront distribution con Terraform (infra/storage.tf). Se sirve en cdn.divain.space."
            />
            <Integration
              name="Sentry"
              hint="Error monitoring"
              status="disconnected"
              detail="Optional but recommended"
            />
          </div>
        </TabsContent>

        {/* ─── Team ─── */}
        <TabsContent value="team">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">2 members. Approvals can be set as admin-only.</p>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Invite</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {[
                  { name: "Faun (you)", email: "faun@divainparfums.com", role: "Admin" },
                  { name: "Pendiente de invitar", email: "marketing@divainparfums.com", role: "User" },
                ].map((m) => (
                  <li key={m.email} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[11px]">{m.name[0]}</div>
                      <div>
                        <div className="text-[13px] font-medium">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                    <Badge variant={m.role === "Admin" ? "accent" : "muted"}>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── API ─── */}
        <TabsContent value="api">
          <Card>
            <CardHeader><CardTitle>API keys</CardTitle><CardDescription>For external agent / pipeline integrations</CardDescription></CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              <div className="rounded-md border border-border bg-card/40 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">Asset ingestion (external agent)</div>
                  <div className="text-[10px] text-muted-foreground font-mono">sk_live_assets_••••_K2pq</div>
                </div>
                <Button variant="outline" size="sm">Rotate</Button>
              </div>
              <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> New key</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Compliance ─── */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader><CardTitle>GDPR & deliverability</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <ComplianceRow label="One-click unsubscribe (RFC 8058)" ok body="List-Unsubscribe + List-Unsubscribe-Post headers injected on every send" />
              <ComplianceRow label="Suppression list (cross-store)" ok body="A bounce or complaint on one store suppresses the email across all 4" />
              <ComplianceRow label="Preference center" ok body="https://sendify.divain.space/p/{customerId}" />
              <ComplianceRow label="Data retention" ok body="Send rows kept 13 months, then archived to S3 Glacier" />
              <ComplianceRow label="Right to erasure" ok body="Tombstone replacement on Customer record, immediate PII purge" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function Integration({ name, hint, status, detail }: { name: string; hint: string; status: "connected" | "action" | "disconnected"; detail: string }) {
  const badge =
    status === "connected" ? <Badge variant="positive">Connected</Badge> :
    status === "action" ? <Badge variant="warning">Action needed</Badge> :
    <Badge variant="muted">Not connected</Badge>;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13px]">{name}</span>
              {badge}
            </div>
            <div className="text-[10px] text-muted-foreground">{hint}</div>
            <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
          </div>
          <Button variant="ghost" size="icon-sm"><ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Delivery({ time, status, event, id, failed }: { time: string; status: string; event: string; id: string; failed?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={failed ? "danger" : "positive"} className="font-mono">{status}</Badge>
        <span className="font-mono text-muted-foreground">{event}</span>
        <span className="font-mono truncate">{id}</span>
      </div>
      <span className="text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}

function ComplianceRow({ label, body, ok }: { label: string; body: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/40 p-3">
      <div>
        <div className="text-[12px] font-medium flex items-center gap-2">
          {ok && <Check className="h-3 w-3 text-[color:var(--positive)]" />}
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{body}</div>
      </div>
      <a className="text-[11px] text-[color:var(--accent)] inline-flex items-center gap-1" href="#">Configure <ExternalLink className="h-2.5 w-2.5" /></a>
    </div>
  );
}
