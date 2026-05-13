// GET /api/assets/[id]
//
// Serves the raw bytes of an Asset stored inline in the DB (no S3 needed
// during bootstrap). Cached at the edge so the email clients that fetch the
// banner don't hammer Sendify on every open.
//
// Public — assets are referenced from email HTML which is rendered outside
// our domain.

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Email clients fetch this URL from inside the rendered HTML. Cold-start Neon
// can take 5-10s for the first query plus a few more to stream a 50-200KB blob
// from Bytes — without maxDuration > 10s the function dies before responding
// and clients render the broken-image icon (or the iframe just stays blank).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Quick warmup ping so the real findUnique races cold-start.
  await prisma.$queryRaw`SELECT 1`.catch(() => {});
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { mimeType: true, data: true, url: true },
  });

  // If we have a CDN URL, redirect (preferred path once S3 is wired).
  if (asset?.url && asset.url.length > 0) {
    return Response.redirect(asset.url, 302);
  }

  if (!asset?.data) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(asset.data, {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(asset.data.length),
    },
  });
}
