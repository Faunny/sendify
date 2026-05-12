// MJML compilation. We render server-side because mjml is a Node-only library.
// Templates store the MJML source; we compile to HTML at approval time and snapshot
// (HTML + hash) on the CampaignVariant for audit and consistent re-sends.

import mjml2html from "mjml";
import { createHash } from "node:crypto";

export type RenderResult = {
  html: string;
  hash: string;
  errors: string[];
};

// `@types/mjml` declares the return as `Promise<MJMLParseResults>` but the runtime
// returns a sync object. Cast through the actual shape.
type MjmlSyncResult = {
  html: string;
  errors: { tagName?: string; message: string }[];
};

export function renderMjml(mjml: string): RenderResult {
  const result = mjml2html(mjml, {
    keepComments: false,
    minify: true,
    validationLevel: "soft",
  }) as unknown as MjmlSyncResult;
  return {
    html: result.html,
    hash: createHash("sha256").update(result.html).digest("hex").slice(0, 32),
    errors: result.errors.map((e) => `${e.tagName ?? "mjml"}: ${e.message}`),
  };
}

// Inject per-recipient tokens. Real implementation supports more — first_name, product_recommendation, etc.
export function personalize(html: string, ctx: Record<string, string>) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}
