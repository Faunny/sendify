import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateEditor } from "@/components/app/template-editor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = await prisma.template.findUnique({
    where: { id },
    select: { id: true, name: true, mjml: true, updatedAt: true, store: { select: { name: true, slug: true } } },
  });
  if (!tpl) notFound();

  return (
    <div className="flex flex-col gap-3 h-full">
      <Link href="/templates" className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Templates
      </Link>
      <TemplateEditor template={{ id: tpl.id, name: tpl.name, mjml: tpl.mjml, storeName: tpl.store?.name ?? null, storeSlug: tpl.store?.slug ?? null }} />
    </div>
  );
}
