import { ClipboardList, Globe, MousePointer, Code } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CreateFormButton } from "@/components/app/create-form-button";
import { FormCard } from "@/components/app/form-card";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const [forms, stores] = await Promise.all([
    prisma.form.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, slug: true, name: true, kind: true, status: true,
        impressions: true, submissions: true, updatedAt: true,
        store: { select: { name: true, slug: true } },
      },
    }).catch(() => []),
    prisma.store.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Forms"
        description="Formularios web para capturar emails desde tu Shopify storefront, popups o landing pages. Cada submission llega como Customer y dispara los flows."
        actions={<CreateFormButton stores={stores} />}
      />

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--accent)]/10">
              <ClipboardList className="h-5 w-5 text-[color:var(--accent)]" />
            </div>
            <div>
              <div className="text-[15px] font-medium">Sin formularios todavía</div>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-md">
                Cada form se publica con un snippet JS que pegas en cualquier página HTML — Shopify theme.liquid, Webflow, WordPress, lo que sea. Las conversiones se atan al Customer correcto y suben tus métricas de subscripción.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 max-w-2xl">
              <FeatureMini icon={<Globe className="h-4 w-4" />}    title="Embed en cualquier sitio" body="Snippet <script> + <div> · zero deps" />
              <FeatureMini icon={<MousePointer className="h-4 w-4" />} title="Popup configurable"   body="Exit-intent · delay · scroll" />
              <FeatureMini icon={<Code className="h-4 w-4" />}     title="Campos a medida"     body="Email, name, phone, select, consent checkbox" />
            </div>
            <CreateFormButton stores={stores} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {forms.map((f) => <FormCard key={f.id} form={f} />)}
        </div>
      )}
    </div>
  );
}

function FeatureMini({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3 text-left">
      <div className="flex items-center gap-1.5 text-[13px] font-medium">{icon}{title}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{body}</div>
    </div>
  );
}
