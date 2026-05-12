"use client";

import Link from "next/link";
import { Building2, Check, ChevronRight, ExternalLink, Key, Languages, Mail, Plug, Plus, ShieldCheck, Users, Webhook } from "lucide-react";
import { CredentialCard } from "@/components/app/credential-card";
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

                  <div className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)] p-3 text-[11px] mb-2">
                    <div className="font-medium text-foreground mb-1">📘 Dónde sacar las credenciales en Shopify</div>
                    <ol className="space-y-0.5 list-decimal pl-4 text-muted-foreground">
                      <li>Abre <a href={`https://${s.shopifyDomain}/admin/settings/apps/development`} target="_blank" className="text-[color:var(--accent)] underline">Settings → Apps and sales channels → Develop apps</a></li>
                      <li>Crea el app &quot;Sendify&quot; → Configuration → marca los scopes: <code className="text-[10px] bg-muted px-1 rounded">read/write_customers, _orders, _products, _checkouts, _marketing_events, _discounts, _translations, _metaobjects</code> → <strong className="text-foreground">Install app</strong></li>
                      <li>Tab <strong className="text-foreground">API credentials</strong> → copia el <strong className="text-foreground">Admin API access token</strong> (empieza por <code className="text-[10px] bg-muted px-1 rounded">shpat_</code>) y pégalo en <strong className="text-foreground">①</strong></li>
                      <li>Copia también el <strong className="text-foreground">API secret key</strong> y pégalo en <strong className="text-foreground">②</strong> (para validar HMAC de webhooks)</li>
                    </ol>
                    <div className="mt-2 text-[10px] text-muted-foreground">Sendify detecta automáticamente el formato: si pegas un <code>shpat_</code> lo usa directo; si pegas un Client ID lo intercambia por un token via OAuth.</div>
                  </div>

                  <CredentialCard
                    provider="SHOPIFY"
                    scope={s.slug}
                    title="① Admin API access token"
                    hint={`Admin API access token de la Custom App en ${s.shopifyDomain} · empieza por shpat_`}
                    detail="Token que usa Sendify para todas las llamadas al Admin API (read customers, products, orders, etc.). Permanente hasta que rotes el app."
                    helpUrl={`https://${s.shopifyDomain}/admin/settings/apps/development`}
                    helpUrlLabel="Ver mi Custom App →"
                  />

                  <CredentialCard
                    provider="SHOPIFY"
                    scope={`${s.slug}:secret`}
                    title="② API secret key (para webhooks)"
                    hint="API credentials → API secret key de la misma Custom App"
                    detail="Validar HMAC-SHA256 de los webhooks entrantes de Shopify."
                    helpUrl={`https://${s.shopifyDomain}/admin/settings/apps/development`}
                  />

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
          <div className="space-y-4">

            <div className="rounded-md border border-border bg-card/40 p-4 text-[12px] leading-relaxed">
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

            {/* Translation engine: choose between DeepSeek (cheap, default), OpenAI, DeepL */}
            <section>
              <h2 className="text-[13px] font-medium mb-1">Traducción</h2>
              <p className="text-[11px] text-muted-foreground mb-3">Sendify usa el primer engine configurado. Para cambiar, sube una credencial nueva o elimina la actual. La traducción se cachea, así que pagas por carácter sólo la primera vez.</p>
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
              <h2 className="text-[13px] font-medium mb-1">Generación de imágenes AI</h2>
              <p className="text-[11px] text-muted-foreground mb-3">Para crear banners y heros desde el builder. Gemini 2.5 Flash Image (Nano Banana) es la primera opción; DALL-E (vía OpenAI) como fallback.</p>
              <div className="grid gap-3">
                <CredentialCard
                  provider="IMAGE_GEMINI"
                  title="Google Gemini 2.5 Flash Image (Nano Banana)"
                  hint="$0.04 por imagen · paleta de marca divain inyectada automáticamente"
                  detail="Free tier disponible para empezar. Soporta 1:1, 3:2, 16:9, 9:16."
                  helpUrl="https://aistudio.google.com/apikey"
                  helpUrlLabel="Conseguir API key (gratis) →"
                />
                <CredentialCard
                  provider="IMAGE_OPENAI"
                  title="OpenAI · DALL-E"
                  hint="Fallback · ~$0.04/image (DALL-E 3)"
                  detail="Si ya pegaste OPENAI arriba, no hace falta repetirla aquí — es la misma."
                  helpUrl="https://platform.openai.com/api-keys"
                />
              </div>
            </section>

            {/* Commercial copy review */}
            <section>
              <h2 className="text-[13px] font-medium mb-1">Revisión de copy comercial (opcional)</h2>
              <p className="text-[11px] text-muted-foreground mb-3">Una pasada de GPT-4 sobre el texto traducido para ajustar tono y eliminar claims problemáticos antes de aprobar. Recomendado para campañas con descuentos fuertes.</p>
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
              <h2 className="text-[13px] font-medium mb-1">Secretos de webhooks</h2>
              <p className="text-[11px] text-muted-foreground mb-3">HMAC para firmar tráfico entrante de proyectos externos. Genera uno aleatorio y configúralo en ambos lados.</p>
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

          {/* ── Promotion source webhook details (legacy block, kept for reference) ── */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Webhook className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Promotion source endpoint</CardTitle>
              <CardDescription>Tu proyecto externo hace POST aquí para crear/actualizar promociones. Sendify las refleja y auto-drafta una campaña N días antes de cada fecha.</CardDescription>
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

          {/* AWS / Shopify / Google Ads viven en sus propios tabs porque tienen UIs más
              ricas: Shopify necesita pegar 4 tokens uno por tienda y disparar la sync inicial,
              SES necesita registros DNS por dominio, Google Ads necesita OAuth. */}
          <Card className="mt-4 bg-card/40">
            <CardContent className="p-4 text-[11px] text-muted-foreground">
              <strong className="text-foreground">¿Buscas Shopify, AWS SES o Google Ads?</strong>  Tienen su propio tab arriba — necesitan más que una API key (tokens por tienda, verificación DNS, OAuth).
            </CardContent>
          </Card>
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
