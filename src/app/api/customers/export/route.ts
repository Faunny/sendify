// GET /api/customers/export
//
// Streams the entire customer table as a CSV. The /customers page links here
// with a normal <a download> so the browser saves the file. Uses cursor-style
// pagination internally to handle 1.5M rows without holding everything in
// memory at once.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK = 5000;

function csvEscape(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // Quote if it contains comma / quote / newline; double up internal quotes.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return new Response("unauthorized", { status: 401 });

  // ReadableStream so the file starts downloading immediately without
  // serializing the whole table to memory.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      // Header row
      controller.enqueue(enc.encode([
        "email", "first_name", "last_name", "country", "language",
        "consent_status", "total_spent", "orders_count", "shopify_tags",
        "created_at",
      ].join(",") + "\n"));

      let cursor: string | undefined;
      let safety = 1000; // up to 5M rows; sanity bound

      while (safety-- > 0) {
        const batch = await prisma.customer.findMany({
          where: { deletedAt: null },
          orderBy: { id: "asc" },
          take: CHUNK,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: {
            id: true, email: true, firstName: true, lastName: true,
            country: true, language: true, consentStatus: true,
            totalSpent: true, ordersCount: true, shopifyTags: true,
            createdAt: true,
          },
        });
        if (batch.length === 0) break;
        for (const c of batch) {
          controller.enqueue(enc.encode([
            csvEscape(c.email),
            csvEscape(c.firstName),
            csvEscape(c.lastName),
            csvEscape(c.country),
            csvEscape(c.language),
            csvEscape(c.consentStatus),
            csvEscape(c.totalSpent.toString()),
            String(c.ordersCount),
            csvEscape(c.shopifyTags.join("|")),
            csvEscape(c.createdAt.toISOString()),
          ].join(",") + "\n"));
        }
        if (batch.length < CHUNK) break;
        cursor = batch[batch.length - 1].id;
      }
      controller.close();
    },
  });

  const filename = `sendify-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
