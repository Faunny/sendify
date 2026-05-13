import { ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AssetLibraryClient } from "@/components/app/asset-library-client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  // Warmup the connection so the first list query is fast.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [assets, total, unused] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [{ usedCount: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true, name: true, mimeType: true, tags: true, prompt: true, notes: true,
        generatedBy: true, usedCount: true, lastUsedAt: true, sizeBytes: true,
        createdAt: true, url: true,
      },
    }).catch(() => []),
    prisma.asset.count().catch(() => 0),
    prisma.asset.count({ where: { usedCount: 0 } }).catch(() => 0),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Asset library"
        description={`${total} assets · ${unused} sin usar · listos para reutilizar en plantillas. Los agentes externos pueden depositar imágenes vía POST /api/assets con bearer token.`}
      />

      <AssetLibraryClient
        initialAssets={assets.map((a) => ({ ...a, serveUrl: `/api/assets/${a.id}`, createdAt: a.createdAt.toISOString(), lastUsedAt: a.lastUsedAt?.toISOString() ?? null }))}
        initialCounts={{ total, unused, used: total - unused }}
      />

      {total === 0 && (
        <div className="rounded-md border border-border bg-card/40 p-8 text-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <div className="text-[14px] font-medium">Sin assets todavía</div>
          <div className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
            Los heros generados por la IA aparecen aquí automáticamente al cabo de unas generaciones. También puedes subir manualmente vía POST /api/assets (acepta base64 o url) con bearer token.
          </div>
        </div>
      )}
    </div>
  );
}
