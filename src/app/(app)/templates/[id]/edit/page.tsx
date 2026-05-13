import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateEditor } from "@/components/app/template-editor";
import { prisma } from "@/lib/db";
import { renderMjml } from "@/lib/mjml";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Warmup ping so Neon cold-start doesn't make the page hang 10s+.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});
  const tpl = await prisma.template.findUnique({
    where: { id },
    select: {
      id: true, name: true, mjml: true, updatedAt: true,
      store: { select: { name: true, slug: true, brandLogoUrl: true } },
    },
  });
  if (!tpl) notFound();

  // Compile MJML server-side so the preview iframe shows instantly on first
  // paint — no waiting for a hydrated POST to /render to land.
  let initialHtml = "";
  try {
    const { html } = renderMjml(tpl.mjml);
    initialHtml = html;
  } catch {
    /* editor will surface render errors */
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <Link href="/templates" className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Templates
      </Link>
      <TemplateEditor
        template={{
          id: tpl.id, name: tpl.name, mjml: tpl.mjml,
          storeName: tpl.store?.name ?? null,
          storeSlug: tpl.store?.slug ?? null,
          storeLogoUrl: tpl.store?.brandLogoUrl ?? null,
        }}
        initialHtml={initialHtml}
      />
    </div>
  );
}
