// GET /api/assets/pool-status
//
// Tells an external image-generation agent (Higgsfield, Midjourney bot, etc)
// exactly which (layoutPattern × storeSlug) combinations are running low on
// unused assets, so the agent can prioritise what to generate next.
//
// Returns:
//   { ok: true,
//     targets: { layoutPattern, storeSlug, unusedCount, deficit }[],
//     totals: { layout: { id: count }, store: { slug: count } } }
//
// "deficit" = how many more assets we want for that combo (target depth - unused).
// An agent should generate `deficit` images for combos with deficit > 0.
//
// Auth: same as the rest of /api/assets — bearer token (ASSET_LIBRARY_TOKEN)
// for external agents OR an admin session for the dashboard.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LAYOUT_LIBRARY } from "@/lib/ai/template-patterns";

export const dynamic = "force-dynamic";

// Target depth per (layout × store) combo. The agent's job is to keep at
// least this many UNUSED assets per combo in the library. 3 is conservative —
// enough that the email generator never falls back to runtime Gemini except
// in genuine outage cases. Bump if you want more variety per email.
const TARGET_DEPTH_PER_COMBO = 3;

export async function GET(req: Request) {
  const session = await auth();
  const bearer = req.headers.get("authorization");
  const tokenOk = bearer && process.env.ASSET_LIBRARY_TOKEN && bearer === `Bearer ${process.env.ASSET_LIBRARY_TOKEN}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id && !tokenOk) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // The version marker on tags is what the generator uses to filter old assets
  // out of its library lookup — anything pre-v4-with-product won't be reused
  // because the prompts changed. Keep this in sync with PROMPT_VERSION in
  // generate-template.ts.
  const PROMPT_VERSION = "v4-with-product";

  const stores = await prisma.store.findMany({
    where: { active: true },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  // Pull every UNUSED asset that's tagged v4. Group in memory by layout+store
  // tags so we know depth per combo without N×M Prisma queries.
  const unused = await prisma.asset.findMany({
    where: {
      kind: "IMAGE",
      usedCount: 0,
      tags: { has: PROMPT_VERSION },
    },
    select: { id: true, tags: true },
  });

  const layouts = LAYOUT_LIBRARY.map((l) => l.id);
  const targets: Array<{
    layoutPattern: string;
    storeSlug: string;
    unusedCount: number;
    deficit: number;
    targetDepth: number;
  }> = [];
  const totalByLayout: Record<string, number> = {};
  const totalByStore: Record<string, number> = {};

  for (const layoutId of layouts) {
    for (const store of stores) {
      const count = unused.filter((a) => a.tags.includes(layoutId) && a.tags.includes(store.slug)).length;
      totalByLayout[layoutId] = (totalByLayout[layoutId] ?? 0) + count;
      totalByStore[store.slug] = (totalByStore[store.slug] ?? 0) + count;
      targets.push({
        layoutPattern: layoutId,
        storeSlug: store.slug,
        unusedCount: count,
        deficit: Math.max(0, TARGET_DEPTH_PER_COMBO - count),
        targetDepth: TARGET_DEPTH_PER_COMBO,
      });
    }
  }

  // Sort by largest deficit first so an agent can grab the top-N rows and know
  // which combos to fix.
  targets.sort((a, b) => b.deficit - a.deficit || a.layoutPattern.localeCompare(b.layoutPattern));

  return NextResponse.json({
    ok: true,
    promptVersion: PROMPT_VERSION,
    targetDepthPerCombo: TARGET_DEPTH_PER_COMBO,
    totalUnused: unused.length,
    totalDeficit: targets.reduce((s, t) => s + t.deficit, 0),
    targets,
    totals: { byLayout: totalByLayout, byStore: totalByStore },
    contract: {
      uploadEndpoint: "POST /api/assets",
      auth: "Bearer <ASSET_LIBRARY_TOKEN>",
      requiredFields: ["base64 | url", "mimeType", "name", "tags"],
      mandatoryTags: [
        "<layoutPattern from targets above>",
        "<storeSlug from targets above>",
        PROMPT_VERSION,
        "ai-generated",
        "hero",
      ],
      examplePayload: {
        name: "hero-lifestyle-divain-europa-001",
        url: "https://higgsfield.cdn/abc.jpg",
        mimeType: "image/jpeg",
        tags: ["lifestyle-hero", "divain-europa", PROMPT_VERSION, "ai-generated", "hero"],
        prompt: "Editorial photograph of woman holding divain perfume bottle in garden at golden hour",
        generatedBy: "agent:higgsfield",
      },
    },
  });
}
