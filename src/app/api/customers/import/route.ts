// POST /api/customers/import
//
// Accepts a Klaviyo CSV upload + storeId, runs it through the same mapper as the CLI,
// and bulk-inserts into Postgres. Designed for **small-to-medium imports (< 100k rows)**
// — for the initial 1.5M migration use `npm run import:klaviyo` instead, which streams
// straight from disk without the upload roundtrip.
//
// Returns a streaming response that the UI consumes for live progress.

import { NextRequest, NextResponse } from "next/server";
import { Writable } from "node:stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mapKlaviyoToCustomer } from "@/lib/import/klaviyo";
import { parse as parseCsv } from "csv-parse";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min · Vercel cap on Pro plan

export async function POST(req: NextRequest) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const storeId = form.get("storeId") as string | null;
  const dryRun = form.get("dryRun") === "true";

  if (!file)    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  if (!storeId) return NextResponse.json({ ok: false, error: "missing storeId" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ ok: false, error: "store not found" }, { status: 404 });

  // Stream the response: one JSON line per progress update so the UI can show a live bar.
  const encoder = new TextEncoder();
  const send = (sink: Writable, payload: Record<string, unknown>) =>
    new Promise<void>((res) => sink.write(encoder.encode(JSON.stringify(payload) + "\n"), () => res()));

  const stream = new ReadableStream({
    async start(controller) {
      const sink = new Writable({
        write(chunk, _enc, cb) {
          controller.enqueue(chunk);
          cb();
        },
      });

      let read = 0, mapped = 0, skipped = 0, inserted = 0;
      const batchSize = 5000;
      let buf: ReturnType<typeof mapKlaviyoToCustomer>[] = [];
      const flush = async () => {
        const valid = buf.filter((c): c is NonNullable<typeof c> => c !== null);
        buf = [];
        if (valid.length === 0) return;
        if (dryRun) { inserted += valid.length; return; }
        const r = await prisma.customer.createMany({ data: valid, skipDuplicates: true });
        inserted += r.count;
      };

      const parser = file.stream().pipeThrough(new TextDecoderStream());
      const reader = parser.getReader();
      let csvText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        csvText += value;
      }

      const records = parseCsv(csvText, {
        columns: (headers: string[]) => headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "")),
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      });

      for await (const row of records) {
        read++;
        const m = mapKlaviyoToCustomer(row, { storeId, defaultLanguage: store.defaultLanguage });
        if (!m) { skipped++; continue; }
        buf.push(m);
        mapped++;
        if (buf.length >= batchSize) {
          await flush();
          await send(sink, { read, mapped, skipped, inserted, done: false });
        }
      }
      await flush();
      await send(sink, { read, mapped, skipped, inserted, done: true, dryRun });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
