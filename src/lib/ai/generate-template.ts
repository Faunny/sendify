// AI template generator. Takes a short brief from the user and asks DeepSeek
// (or OpenAI as fallback) to return a full email — subject + preheader +
// production-ready MJML — pre-styled with divain's brand kit so the output
// doesn't need manual restyling.
//
// The LLM gets the brand palette, typography, footer rules and a list of
// MJML blocks it's allowed to compose. Output is JSON for stable parsing.

import { getCredential } from "../credentials";

export type TemplateGenInput = {
  brief: string;             // free-form: "Día de la Madre — 15% off perfumes mujer, tono cálido"
  pillar: "PARFUMS" | "CARE" | "HOME" | "RITUAL" | "ALL";
  storeSlug?: string;        // divain-europa, etc. (drives footer legal entity)
  language?: string;         // BCP-47 of source; downstream translation handles fan-out
  tone?: string;             // editorial / commercial / luxury / urgent (default: editorial)
};

export type TemplateGenOutput = {
  subject: string;
  preheader: string;
  mjml: string;              // full <mjml>…</mjml> document
  designJson?: unknown;      // optional Unlayer-compatible JSON for round-trip editing
  modelUsed: "deepseek-chat" | "gpt-4o-mini";
  promptTokens?: number;
  completionTokens?: number;
};

const SYSTEM_PROMPT = `You are a senior email designer for divain®, a luxury perfume brand from Alicante, Spain. divain sells alternatives to designer fragrances + own line (PARFUMS, CARE, HOME, RITUAL pillars) across 4 Shopify Plus stores (Europe, UK, USA+Canada, México).

You output **production-ready MJML** for a single email. The output must be valid MJML 4 that compiles cleanly with mjml-node (no custom components — only <mj-section>, <mj-column>, <mj-text>, <mj-button>, <mj-image>, <mj-divider>, <mj-spacer>, <mj-social>, <mj-raw> for hidden preheader).

BRAND RULES — non-negotiable:
- Palette: background #FFFFFF · text #1A1A1A · accent gold #D99425 · soft cream #F5F1EA · charcoal #2C2C2C
- Typography: headlines "Outfit, Helvetica, sans-serif" weight 500-600, body "Inter, Arial, sans-serif" weight 400, line-height 1.55
- Container width 600px desktop, full-width mobile, padding 24px
- Buttons: gold #D99425 background, white text, 12px radius, 14px font, 14px 28px padding, never underlined
- One clear CTA per section, max 2 per email
- Voice: cálido pero refinado · castellano de España neutral · NO emojis · NO "click here" — usa "Descubrir", "Comprar", "Ver colección"
- Preheader: 90-120 chars, hidden via <mj-raw><div style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;...">…</div></mj-raw>
- Footer is INJECTED later by Sendify (legal entity, unsubscribe, address) — do NOT output footer copy, end your MJML BEFORE the footer section.

STRUCTURE (use as a starting point, adapt to brief):
1. Logo header (centered, 120px) → use <mj-image src="https://cdn.divain.space/logo-divain.png" />
2. Hero block (banner + headline + 1 line subhead + CTA) — banner image uses placeholder URL "https://cdn.divain.space/banners/{slug}.jpg" that the user replaces or Gemini generates
3. 2-3 product highlights in a 2- or 3-column grid (image + name + price + small CTA)
4. Editorial block (40-60 word story, single column, optional supporting image)
5. Secondary CTA section (one button, contrasting copy)

Respond with ONLY a JSON object — no commentary, no markdown fences:
{
  "subject": "<60 chars, no emojis, no all-caps>",
  "preheader": "<90-120 chars, complements subject, no repetition>",
  "mjml": "<full valid <mjml> document>"
}`;

function buildUserPrompt(input: TemplateGenInput): string {
  const pillarHint = input.pillar === "ALL"
    ? "Audience: general divain customers. Reference the full brand."
    : `Pillar: divain. ${input.pillar} (focus the email around this line)`;
  const toneHint = input.tone ? `Tone: ${input.tone}` : "Tone: editorial-warm (default)";
  const langHint = input.language ? `Source language: ${input.language} (downstream translation fans out to 22 langs)` : "Source language: es-ES";

  return `Generate an email for this brief:

"""
${input.brief}
"""

${pillarHint}
${toneHint}
${langHint}

Return the JSON object now.`;
}

export async function generateTemplate(input: TemplateGenInput): Promise<TemplateGenOutput> {
  // Prefer DeepSeek (cheaper, configured first); fall back to OpenAI if missing.
  const deepseek = await getCredential("TRANSLATION_DEEPSEEK");
  const openai   = await getCredential("TRANSLATION_OPENAI");
  const cred = deepseek ?? openai;
  if (!cred) throw new Error("No translation/LLM provider configured. Pega DeepSeek o OpenAI key en Settings → Integrations.");

  const useDeepseek = !!deepseek;
  const url   = useDeepseek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = useDeepseek
    ? (cred.meta?.model as string) ?? "deepseek-chat"
    : (cred.meta?.model as string) ?? "gpt-4o-mini";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = json.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("LLM returned empty response");

  // The model is asked to return pure JSON; strip stray code fences if it ignored.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: { subject?: string; preheader?: string; mjml?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}...`);
  }
  if (!parsed.subject || !parsed.preheader || !parsed.mjml) {
    throw new Error("LLM response missing subject/preheader/mjml");
  }
  if (!parsed.mjml.includes("<mjml>")) {
    throw new Error("LLM mjml output doesn't look like MJML (no <mjml> root)");
  }

  return {
    subject: parsed.subject,
    preheader: parsed.preheader,
    mjml: parsed.mjml,
    modelUsed: useDeepseek ? "deepseek-chat" : "gpt-4o-mini",
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}
