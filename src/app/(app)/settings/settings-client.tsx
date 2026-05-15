"use client";

import Link from "next/link";
import { Building2, Check, ChevronRight, Key, Languages, Mail, Plug, ShieldCheck, Users, Webhook } from "lucide-react";
import { CredentialCard } from "@/components/app/credential-card";
import { AwsSesCard } from "@/components/app/aws-ses-card";
import { ExcludedSkusEditor } from "@/components/app/excluded-skus-editor";
import { AddSenderDialog } from "@/components/app/add-sender-dialog";
import { SenderConfigDialog } from "@/components/app/sender-config-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/page-header";
import { WarmupProgress } from "@/components/app/warmup-progress";
import { LANGUAGES } from "@/lib/languages";

export type SettingsStore = {
  id: string;
  slug: string;
  name: string;
  shopifyDomain: string;
  storefrontUrl: string;
  countryCode: string;
  defaultLanguage: string;
  currency: string;
  productCount: number;
  markets: string[];
  legal: {
    legalName: string;
    vatNumber: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    supportEmail: string;
    supportPhone: string;
  };
  brand: {
    logoUrl: string;
    palette: Record<string, string>;
    fontHeading: string;
    fontBody: string;
  };
};

export type SettingsSender = {
  id: string;
  storeId: string;
  fromEmail: string;
  fromName: string;
  verified: boolean;
  provider: string;
  dailyCap: number;
  warmupStartedAt: string | null;
  warmupTargetPerDay: number;
};

export type SettingsUser = { id: string; name: string | null; email: string; role: string };

export function SettingsClient({ stores: STORES, senders: SENDERS, users: USERS }: { stores: SettingsStore[]; senders: SettingsSender[]; users: SettingsUser[] }) {
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
            <AddSenderDialog stores={STORES.map((s) => ({ slug: s.slug, name: s.name }))} />
          </div>
          <div className="grid gap-3">
            {SENDERS.length === 0 && (
              <div className="rounded-md border border-border bg-card/40 p-6 text-center text-[13px] text-muted-foreground">
                Sin senders configurados. Pulsa <strong className="text-foreground">Add sender</strong> arriba a la derecha para añadir tu primer remitente SES.
              </div>
            )}
            {SENDERS.map((s) => {
              const store = STORES.find((x) => x.id === s.storeId);
              if (!store) return null;
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[14px]">{s.fromEmail}</span>
                          {s.verified ? <Badge variant="positive">Verified</Badge> : <Badge variant="danger">Unverified</Badge>}
                          <Badge variant="muted">{s.provider}</Badge>
                        </div>
                        <div className="text-[12px] text-muted-foreground">{s.fromName} · {store.name}</div>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> DKIM</span>
                          <span className="inline-flex items-center gap-1"><Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> SPF</span>
                          <span className="inline-flex items-center gap-1">{s.verified ? <Check className="h-2.5 w-2.5 text-[color:var(--positive)]" /> : <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] inline-block" />} DMARC</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] text-muted-foreground">Daily cap</div>
                        <div className="text-[14px] tabular-nums">{s.dailyCap.toLocaleString()}</div>
                      </div>
                      <SenderConfigDialog
                        sender={{ id: s.id, fromEmail: s.fromEmail, fromName: s.fromName, verified: s.verified, dailyCap: s.dailyCap }}
                        trigger={<Button variant="outline" size="sm">Configure</Button>}
                      />
                    </div>
                    <WarmupProgress sender={{
                      warmupStartedAt: s.warmupStartedAt ? new Date(s.warmupStartedAt) : null,
                      warmupTargetPerDay: s.warmupTargetPerDay,
                      dailyCap: s.dailyCap,
                    }} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Stores ─── */}
        <TabsContent value="stores">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Shopify Plus stores, legal entities and brand kit. Webhooks auto-installed. {STORES.length} active.</p>
            {/* "Connect store" button removed — connecting a new Shopify store
                today happens by seeding it via DB or via the schema migration
                script. A proper "Add Store" dialog is a follow-up. */}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {STORES.length === 0 && (
              <div className="col-span-full rounded-md border border-border bg-card/40 p-6 text-center text-[13px] text-muted-foreground">
                Sin tiendas conectadas todavía.
              </div>
            )}
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
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Markets sold into</div>
                    <div className="flex flex-wrap gap-1">
                      {s.markets.map((m) => <Badge key={m} variant="muted" className="text-[11px]">{m}</Badge>)}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-2.5">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Product pillars</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="muted" className="text-[11px]">divain. PARFUMS</Badge>
                      <Badge variant="muted" className="text-[11px]">divain. CARE</Badge>
                      <Badge variant="muted" className="text-[11px]">divain. HOME</Badge>
                      <Badge variant="muted" className="text-[11px]">divain. RITUAL</Badge>
                    </div>
                  </div>

                  <div className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] p-3 text-[12px] mb-2">
                    <div className="font-medium text-foreground mb-1">📘 Dónde sacar Client ID + Client secret en Shopify</div>
                    <ol className="space-y-0.5 list-decimal pl-4 text-muted-foreground">
                      <li>Abre <a href={`https://${s.shopifyDomain}/admin/settings/apps/development`} target="_blank" className="text-[color:var(--accent)] underline">Settings → Apps and sales channels → Develop apps</a></li>
                      <li>Crea el app &quot;Sendify&quot; → Configuration → marca scopes: <code className="text-[11px] bg-muted px-1 rounded">read/write_customers, _orders, _products, _checkouts, _marketing_events, _discounts, _translations, _metaobjects</code> → <strong className="text-foreground">Install app</strong></li>
                      <li>Tab <strong className="text-foreground">API credentials</strong> → copia <strong className="text-foreground">Client ID</strong> y <strong className="text-foreground">Client secret</strong> y pégalos abajo</li>
                    </ol>
                    <div className="mt-2 text-[11px] text-muted-foreground">Sendify intercambia ambos por un access token via OAuth client_credentials, lo cachea por tienda, y lo refresca cuando caduca.</div>
                  </div>

                  <CredentialCard
                    provider="SHOPIFY"
                    scope={s.slug}
                    title="① Client ID"
                    hint={`API credentials → Client ID de la Custom App en ${s.shopifyDomain}`}
                    detail="Identificador público de la app. Va junto con el Client secret en cada exchange OAuth."
                    helpUrl={`https://${s.shopifyDomain}/admin/settings/apps/development`}
                    helpUrlLabel="Ver mi Custom App →"
                  />

                  <CredentialCard
                    provider="SHOPIFY"
                    scope={`${s.slug}:secret`}
                    title="② Client secret"
                    hint="API credentials → Client secret de la misma Custom App"
                    detail="Usado para (a) intercambiar por un access token via OAuth client_credentials, y (b) validar HMAC-SHA256 de los webhooks entrantes de Shopify."
                    helpUrl={`https://${s.shopifyDomain}/admin/settings/apps/development`}
                  />

                  <ExcludedSkusEditor storeSlug={s.slug} storeName={s.name} />

                  <div className="rounded-md border border-border bg-card/40 p-3 space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Legal entity (footer)</div>
                    <div className="text-[13px] font-medium">{s.legal.legalName}</div>
                    <div className="text-[12px] text-muted-foreground">{s.legal.vatNumber}</div>
                    <div className="text-[12px] text-muted-foreground leading-relaxed">{s.legal.address}, {s.legal.postalCode} {s.legal.city}, {s.legal.country}</div>
                    <div className="text-[12px] text-muted-foreground">{s.legal.supportEmail} · {s.legal.supportPhone}</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-1.5">
                      Para editar estos datos legales, actualízalos en la Store via Prisma (campos Store.legalName / legalAddress / etc). Editor en UI pendiente.
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Brand kit</div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
                        <Link href="/settings/brand">Customize →</Link>
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md bg-cover bg-center border border-border" style={{ backgroundImage: `url(${s.brand.logoUrl})` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-muted-foreground mb-1">Palette</div>
                        <div className="flex items-center gap-1">
                          {Object.entries(s.brand.palette).map(([k, v]) => (
                            <div key={k} title={`${k} · ${v}`} className="h-5 w-5 rounded-sm border border-border" style={{ background: v }} />
                          ))}
                        </div>
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
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
                        <div className="text-[14px] font-medium">{l.label}</div>
                        <div className="text-[11px] text-muted-foreground">{l.nativeLabel} · BCP-47 {l.code} · DeepL {l.deeplCode} · {l.countries.length} country{l.countries.length > 1 ? "ies" : ""}</div>
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
          <div className="space-y-4">

            <div className="rounded-md border border-border bg-card/40 p-4 text-[13px] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[color:var(--positive)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-foreground mb-1">Cómo se guardan estas API keys</div>
                  <p className="text-muted-foreground">
                    Cada key que pegues abajo viaja por HTTPS desde tu browser hasta una función serverless de Vercel,
                    que la encripta con <strong className="text-foreground">AES-256-GCM</strong> (usando AUTH_SECRET como master key) ANTES de guardarla en Neon.
                    En el disco de Neon vive sólo el ciphertext en base64 · sin AUTH_SECRET es matemáticamente imposible descifrarla.
                  </p>
                  <p className="text-muted-foreground mt-1.5">
                    <strong className="text-foreground">Lo que no veo yo</strong>: lo que pegues en los campos de abajo · va directo del browser al server sin pasar por mí.
                    <strong className="text-foreground"> Lo que sí veo</strong>: cualquier cosa que escribas en el chat con texto plano.
                    Recomendación: pega las keys SOLO aquí en Settings, nunca en el chat.
                  </p>
                </div>
              </div>
            </div>

            {/* Email sending: Amazon SES (the actual sender of the 20M emails/mo) */}
            <section>
              <h2 className="text-[14px] font-medium mb-1">Envío de email · Amazon SES</h2>
              <p className="text-[12px] text-muted-foreground mb-3">El IAM user con permisos <code>ses:SendEmail</code>. Se usa para todos los envíos, tests y warmup. Sin esto Sendify funciona en dev-mode (no se envían emails de verdad).</p>
              <AwsSesCard />
            </section>

            {/* Translation engine: choose between DeepSeek (cheap, default), OpenAI, DeepL */}
            <section>
              <h2 className="text-[14px] font-medium mb-1">Traducción</h2>
              <p className="text-[12px] text-muted-foreground mb-3">Sendify usa el primer engine configurado. Para cambiar, sube una credencial nueva o elimina la actual. La traducción se cachea, así que pagas por carácter sólo la primera vez.</p>
              <div className="grid gap-3">
                <CredentialCard
                  provider="TRANSLATION_DEEPSEEK"
                  title="DeepSeek"
                  hint="Recomendado · ~$0.14/1M tokens input · LLM rápido para traducción comercial"
                  detail="API compatible con OpenAI. Modelo por defecto: deepseek-chat."
                  helpUrl="https://platform.deepseek.com/api_keys"
                  helpUrlLabel="Conseguir API key →"
                />
                <CredentialCard
                  provider="TRANSLATION_OPENAI"
                  title="OpenAI"
                  hint="Alternativa · gpt-4o-mini por defecto · más caro pero más fiable en idiomas raros"
                  detail="Misma key vale para Image (DALL-E) y Review (GPT-4 commercial copy)."
                  helpUrl="https://platform.openai.com/api-keys"
                  helpUrlLabel="Conseguir API key →"
                />
                <CredentialCard
                  provider="TRANSLATION_DEEPL"
                  title="DeepL Pro"
                  hint="Legacy · sólo si lo prefieres explícitamente"
                  helpUrl="https://www.deepl.com/pro-api"
                  helpUrlLabel="Cuenta DeepL Pro →"
                />
              </div>
            </section>

            {/* AI image generation */}
            <section>
              <h2 className="text-[14px] font-medium mb-1">Generación de imágenes AI</h2>
              <p className="text-[12px] text-muted-foreground mb-3">Para banners/heros. <strong className="text-foreground">GPT Image 1 (OpenAI)</strong> es la primera opción si está configurado, con Gemini 2.5 Flash Image como fallback automático cuando uno se queda sin cuota.</p>
              <div className="grid gap-3">
                <CredentialCard
                  provider="IMAGE_OPENAI"
                  title="OpenAI · GPT Image 2"
                  hint="Preferido · ~$0.04-0.06/imagen medium 1536x1024 · modelo gpt-image-2"
                  detail="Sendify usa gpt-image-2 por defecto y cae a gpt-image-1 si tu cuenta aún no tiene acceso al 2. La misma key OpenAI también vale para templates si la pegas en TRANSLATION_OPENAI arriba."
                  helpUrl="https://platform.openai.com/api-keys"
                  helpUrlLabel="Conseguir API key →"
                />
                <CredentialCard
                  provider="IMAGE_GEMINI"
                  title="Google Gemini 2.5 Flash Image (fallback)"
                  hint="Free tier ~50-100/día · paid ~$0.04/imagen · activa billing en el proyecto Cloud para subir cuotas"
                  detail="Tu suscripción Google AI Ultra es solo consumer (gemini.google.com), NO sube las cuotas de esta API. Hay que activar billing en aistudio.google.com/apikey → click en tu key."
                  helpUrl="https://aistudio.google.com/apikey"
                  helpUrlLabel="Configurar key + billing →"
                />
              </div>
            </section>

            {/* Commercial copy review */}
            <section>
              <h2 className="text-[14px] font-medium mb-1">Revisión de copy comercial (opcional)</h2>
              <p className="text-[12px] text-muted-foreground mb-3">Una pasada de GPT-4 sobre el texto traducido para ajustar tono y eliminar claims problemáticos antes de aprobar. Recomendado para campañas con descuentos fuertes.</p>
              <div className="grid gap-3">
                <CredentialCard
                  provider="REVIEW_OPENAI"
                  title="OpenAI GPT-4 · tone review"
                  hint="Revisa el copy traducido antes de aprobar. Detecta claims y suaviza tono"
                  helpUrl="https://platform.openai.com/api-keys"
                />
              </div>
            </section>

            {/* Compliance / webhook secrets */}
            <section>
              <h2 className="text-[14px] font-medium mb-1">Secretos de webhooks</h2>
              <p className="text-[12px] text-muted-foreground mb-3">HMAC para firmar tráfico entrante de proyectos externos. Genera uno aleatorio y configúralo en ambos lados.</p>
              <div className="grid gap-3">
                <CredentialCard
                  provider="PROMOTIONS_WEBHOOK_SECRET"
                  title="Promotions webhook secret"
                  hint="Tu proyecto externo de calendario firma cada POST /api/promotions/webhook con HMAC-SHA256 usando este secreto"
                />
                <CredentialCard
                  provider="SNS_WEBHOOK_SECRET"
                  title="SNS / SES events secret"
                  hint="Validación de los eventos SES → SNS → /api/ses/events"
                />
              </div>
            </section>

          </div>

          {/* ── Promotion source webhook URL · the secret itself is the one saved in the
                "Promotions webhook secret" card above (encrypted, AES-256-GCM in Neon). ── */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]"><Webhook className="h-4 w-4 text-[color:var(--accent)]" /> Promotion source endpoint</CardTitle>
              <CardDescription className="text-[14px]">Tu proyecto externo hace POST aquí para crear/actualizar promociones. Sendify las refleja y auto-drafta una campaña N días antes de cada fecha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="rounded-md border border-border bg-card/40 p-3">
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">Webhook URL</div>
                <div className="font-mono text-[14px] flex items-center justify-between gap-2">
                  <span className="truncate">https://sendify.divain.space/api/promotions/webhook</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12px]"
                    onClick={() => navigator.clipboard?.writeText("https://sendify.divain.space/api/promotions/webhook")}
                  >Copy</Button>
                </div>
              </div>
              <div className="rounded-md border border-border bg-card/40 p-3">
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">Signing secret (HMAC-SHA256)</div>
                <div className="text-[13px] text-muted-foreground">
                  Se configura en el card <strong className="text-foreground">&quot;Promotions webhook secret&quot;</strong> de arriba ↑.
                  Tu sender hace <code className="text-[12px] bg-muted px-1 rounded">hex(hmac_sha256(secret, raw_body))</code> y lo manda en el header <code className="text-[12px] bg-muted px-1 rounded">X-Sendify-Signature: sha256=&lt;hmac&gt;</code>.
                </div>
              </div>
              <details className="rounded-md border border-border bg-card/40 p-3 group">
                <summary className="text-[14px] font-medium cursor-pointer flex items-center justify-between">
                  Example payload your project should POST
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                </summary>
                <pre className="mt-3 text-[13px] font-mono bg-[color:var(--bg)] border border-border rounded p-3 overflow-x-auto leading-relaxed">
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

          {/* AWS / Shopify / Google Ads viven en sus propios tabs porque tienen UIs más
              ricas: Shopify necesita pegar 4 tokens uno por tienda y disparar la sync inicial,
              SES necesita registros DNS por dominio, Google Ads necesita OAuth. */}
          <Card className="mt-4 bg-card/40">
            <CardContent className="p-4 text-[12px] text-muted-foreground">
              <strong className="text-foreground">¿Buscas Shopify, AWS SES o Google Ads?</strong>  Tienen su propio tab arriba — necesitan más que una API key (tokens por tienda, verificación DNS, OAuth).
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Team ─── */}
        <TabsContent value="team">
          <div className="mb-3">
            <p className="text-sm text-muted-foreground">{USERS.length} member{USERS.length === 1 ? "" : "s"}. Approvals are admin-only.</p>
          </div>
          <Card>
            <CardContent className="p-0">
              {USERS.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-muted-foreground">
                  Sin usuarios todavía. El primer signup queda como Admin.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {USERS.map((m) => {
                    const displayName = m.name ?? m.email.split("@")[0];
                    return (
                      <li key={m.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[12px]">{displayName[0]?.toUpperCase() ?? "?"}</div>
                          <div>
                            <div className="text-[14px] font-medium">{displayName}</div>
                            <div className="text-[11px] text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                        <Badge variant={m.role === "ADMIN" ? "accent" : "muted"}>{m.role}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          <div className="text-[11px] text-muted-foreground mt-2">
            Para invitar a más usuarios, añade su email + password en la DB (User table). El flujo de invitación por email es follow-up.
          </div>
        </TabsContent>

        {/* ─── API ─── */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API keys</CardTitle>
              <CardDescription>Para integraciones externas con Sendify (asset ingestion, promotion webhook, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5 text-[13px] text-muted-foreground">
              <p>Las API keys de Sendify se gestionan vía variables de entorno en Vercel:</p>
              <ul className="space-y-1.5 ml-5 list-disc text-[12.5px]">
                <li><code className="text-[11px] bg-muted px-1 rounded">ASSET_LIBRARY_TOKEN</code> — bearer para agentes que pushean imágenes a <code className="text-[11px] bg-muted px-1 rounded">POST /api/assets</code></li>
                <li><code className="text-[11px] bg-muted px-1 rounded">PROMOTIONS_WEBHOOK_SECRET</code> — HMAC para validar webhooks de tu calendario externo</li>
                <li><code className="text-[11px] bg-muted px-1 rounded">CRON_SECRET</code> — bearer que Vercel cron usa para golpear endpoints internos</li>
              </ul>
              <p className="pt-2">Para rotar, edita en Vercel project settings → Environment Variables.</p>
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
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[14px] font-medium">{value}</div>
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
              <span className="font-medium text-[14px]">{name}</span>
              {badge}
            </div>
            <div className="text-[11px] text-muted-foreground">{hint}</div>
            <p className="mt-2 text-[12px] text-muted-foreground">{detail}</p>
          </div>
          {/* No expand-action wired for the integration cards — kept as a
              visual chevron to hint future drill-down. Hidden until wired. */}
        </div>
      </CardContent>
    </Card>
  );
}

function Delivery({ time, status, event, id, failed }: { time: string; status: string; event: string; id: string; failed?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-1">
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
        <div className="text-[13px] font-medium flex items-center gap-2">
          {ok && <Check className="h-3 w-3 text-[color:var(--positive)]" />}
          {label}
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{body}</div>
      </div>
      {/* "Configure" link was href="#" — dropped. Compliance items are
          self-explanatory and configured elsewhere. */}
    </div>
  );
}
