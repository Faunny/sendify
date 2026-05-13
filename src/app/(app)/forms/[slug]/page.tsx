import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Code, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { FormPublishButton } from "@/components/app/form-publish-button";
import { CopySnippet } from "@/components/app/copy-snippet";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FormDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await prisma.form.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, kind: true, status: true,
      impressions: true, submissions: true, updatedAt: true,
      fields: true, design: true, behavior: true,
      store: { select: { name: true, slug: true, shopifyDomain: true, storefrontUrl: true } },
    },
  });
  if (!form) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
  const embedUrl = `${appUrl}/api/forms/${form.slug}/embed.js`;
  const containerDiv = `<div id="sendify-form-${form.slug}"></div>`;
  const scriptTag    = `<script src="${embedUrl}" async></script>`;
  const fullEmbed    = `${containerDiv}\n${scriptTag}`;
  const shopifyLiquid = `<!-- Sendify form: ${form.name} -->\n${fullEmbed}`;

  const conv = form.impressions > 0 ? (form.submissions / form.impressions) * 100 : 0;
  const design = (form.design ?? {}) as { headline?: string; subheadline?: string; ctaLabel?: string };
  const fields = (form.fields ?? []) as Array<{ id: string; type: string; label: string; required?: boolean }>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/forms" className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Forms</Link>
      </div>

      <PageHeader
        title={form.name}
        description={`Form ${form.slug} · ${form.kind} · creado para ${form.store?.name ?? "todas las tiendas"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={form.status === "PUBLISHED" ? "positive" : "muted"}>
              {form.status === "PUBLISHED" ? "Publicado" : "Draft"}
            </Badge>
            <FormPublishButton formId={form.id} currentStatus={form.status as "DRAFT" | "PUBLISHED" | "ARCHIVED"} />
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatBig label="Impresiones" value={form.impressions.toLocaleString()} />
        <StatBig label="Submissions" value={form.submissions.toLocaleString()} />
        <StatBig label="Conversión"  value={`${conv.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px] flex items-center gap-2"><Code className="h-4 w-4" /> Embed snippet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">1. HTML donde quieras renderizar el form</div>
              <CopySnippet code={containerDiv} lang="html" />
            </section>
            <section>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">2. Script que carga la lógica</div>
              <CopySnippet code={scriptTag} lang="html" />
            </section>
            <section>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">Ambos juntos · pega-y-listo</div>
              <CopySnippet code={fullEmbed} lang="html" />
            </section>

            {form.store?.shopifyDomain && (
              <section className="border-t border-border pt-3">
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  Shopify · pega en theme.liquid o sections/footer.liquid
                  <a href={`https://${form.store.shopifyDomain}/admin/themes/current/editor`} target="_blank" className="text-[color:var(--accent)] hover:underline inline-flex items-center gap-0.5">
                    Abrir editor de tema <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <CopySnippet code={shopifyLiquid} lang="liquid" />
              </section>
            )}

            {form.status !== "PUBLISHED" && (
              <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] p-2.5 text-[13px] text-[color:var(--warning)]">
                ⚠ El form está en <strong>DRAFT</strong>: el snippet servirá 404 en producción hasta que pulses <strong>Publicar</strong>.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-[14px]">Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border border-border bg-card/40 p-4">
                <div className="text-[16px] font-medium leading-tight">{design.headline ?? "Suscríbete"}</div>
                {design.subheadline && <div className="text-[13px] text-muted-foreground mt-1">{design.subheadline}</div>}
                <div className="space-y-2 mt-3">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                      <div className="h-8 rounded border border-border mt-0.5" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 inline-block rounded-full bg-foreground text-background text-[11px] uppercase tracking-wider px-4 py-1.5">{design.ctaLabel ?? "Suscribirme"}</div>
              </div>
              <div className="mt-3 text-[12px] text-muted-foreground">
                El builder visual editable llega en la siguiente iteración. Los campos + diseño se pueden editar vía <code className="text-[11px] bg-muted px-1 rounded">PUT /api/forms/{form.slug}</code> mientras tanto.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[14px]">URL hospedada</CardTitle></CardHeader>
            <CardContent>
              <CopySnippet code={`${appUrl}/forms/${form.slug}`} lang="text" />
              <div className="text-[12px] text-muted-foreground mt-2">
                Si tu sitio no permite snippets, puedes mandar tráfico directo a esta URL.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBig({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card/40">
      <CardContent className="p-4">
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[24px] font-medium tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
