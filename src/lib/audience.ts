// Audience resolver.
//
// Given a campaign (storeId + segmentIds + excludeAppRecent + appSuppressionHours),
// return the final recipient list as `Recipient` records ready for the send queue.
//
// Filter order matters (cheap → expensive):
//   1. Union of segment memberships
//   2. Drop customers where consent != SUBSCRIBED
//   3. Drop emails on the cross-store suppression list
//   4. Drop customers whose `lastPushAt` is within `appSuppressionHours` (default 24h)
//   5. Bucket each recipient by their `language` so render pipeline knows the targets
//
// The result counts are recorded back on the Campaign for the dashboard, and the
// per-recipient rows become the `Send` ledger.

import { prisma } from "./db";
import { ConsentStatus, type Prisma } from "@prisma/client";

export type Recipient = {
  customerId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  language: string;
  country: string | null;
  hasApp: boolean;
  lastPushAt: Date | null;
};

export type AudienceFilters = {
  storeId: string;
  segmentIds: string[];
  excludeAppRecent: boolean;
  appSuppressionHours: number;
};

export type AudienceResult = {
  recipients: Recipient[];
  byLanguage: Record<string, number>;     // count per BCP-47 language
  dropped: {
    consent: number;
    suppressed: number;
    appRecent: number;
    duplicate: number;
  };
};

export async function resolveAudience(filters: AudienceFilters): Promise<AudienceResult> {
  const { storeId, segmentIds, excludeAppRecent, appSuppressionHours } = filters;
  const pushCutoff = new Date(Date.now() - appSuppressionHours * 3600 * 1000);

  // Single SQL query — let Postgres do the heavy lifting. We join customer_segment
  // to get the set union, anti-join suppressions, and apply the per-customer filters.
  // Returns the raw recipient rows; in-memory de-dup happens below.
  const rows = await prisma.$queryRaw<Array<Recipient & { _consent: ConsentStatus; _suppressed: boolean }>>`
    SELECT DISTINCT
      c.id          AS "customerId",
      c.email,
      c."firstName",
      c."lastName",
      COALESCE(c.language, ${"es-ES"}) AS language,
      c.country,
      c."hasApp",
      c."lastPushAt",
      c."consentStatus" AS _consent,
      (s.email IS NOT NULL) AS _suppressed
    FROM "Customer" c
    INNER JOIN "CustomerSegment" cs ON cs."customerId" = c.id
    LEFT JOIN "Suppression" s ON s.email = c.email
    WHERE c."storeId" = ${storeId}
      AND c."deletedAt" IS NULL
      AND cs."segmentId" = ANY(${segmentIds}::text[])
  `;

  const dropped = { consent: 0, suppressed: 0, appRecent: 0, duplicate: 0 };
  const seen = new Set<string>();
  const out: Recipient[] = [];

  for (const r of rows) {
    if (r._consent !== ConsentStatus.SUBSCRIBED) { dropped.consent++; continue; }
    if (r._suppressed)                            { dropped.suppressed++; continue; }
    if (excludeAppRecent && r.hasApp && r.lastPushAt && r.lastPushAt >= pushCutoff) {
      dropped.appRecent++; continue;
    }
    if (seen.has(r.email)) { dropped.duplicate++; continue; }
    seen.add(r.email);
    out.push({
      customerId: r.customerId,
      email: r.email,
      firstName: r.firstName,
      lastName:  r.lastName,
      language:  r.language,
      country:   r.country,
      hasApp:    r.hasApp,
      lastPushAt: r.lastPushAt,
    });
  }

  const byLanguage: Record<string, number> = {};
  for (const r of out) byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;

  return { recipients: out, byLanguage, dropped };
}

// Helper to bulk-insert `Send` ledger rows. Returns the count inserted.
// Uses createMany with skipDuplicates so a re-run of the pipeline doesn't double-insert.
export async function createSendLedger(args: {
  campaignId: string;
  recipients: Recipient[];
  htmlHashByLanguage: Record<string, string>;
}): Promise<number> {
  const rows: Prisma.SendCreateManyInput[] = args.recipients.map((r) => ({
    campaignId: args.campaignId,
    customerId: r.customerId,
    language: r.language,
    htmlHash: args.htmlHashByLanguage[r.language] ?? null,
    status: "QUEUED",
  }));
  const res = await prisma.send.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}
