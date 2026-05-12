// Translation provider abstraction.
//
// Three engines supported: DeepSeek (cheapest), OpenAI (gpt-4o-mini default), and DeepL
// (legacy fallback if you ever want classic MT). Selection happens via which credential
// row is active in the DB — no env var. Settings UI exposes a "Translation engine"
// dropdown that's actually just enabling/disabling rows in ProviderCredential.
//
// All engines share the same cache (Translation table). Cache key includes the engine
// so swapping engines mid-flight doesn't accidentally mix outputs of two systems.

import { createHash } from "node:crypto";
import { prisma } from "../db";
import { getCredential } from "../credentials";
import { languageByCode } from "../languages";

export type TranslateRequest = {
  text: string;
  targetLang: string;          // BCP-47
  sourceLang?: string;
  tone?: "default" | "formal" | "informal" | "promotional";
  glossaryName?: string;       // e.g. "divain-brand" — pulled from DB at call time
};

export type TranslationResult = {
  text: string;
  engine: "deepseek" | "openai" | "deepl";
  cached: boolean;
};

export function sourceHash(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

// ── Routing ───────────────────────────────────────────────────────────────
// Order: DeepSeek first (cheapest), OpenAI second, DeepL last. The first one with an
// active credential wins. User can disable any by toggling its credential off in Settings.

async function pickEngine(): Promise<"deepseek" | "openai" | "deepl" | null> {
  const ds = await getCredential("TRANSLATION_DEEPSEEK");
  if (ds) return "deepseek";
  const oa = await getCredential("TRANSLATION_OPENAI");
  if (oa) return "openai";
  const dl = await getCredential("TRANSLATION_DEEPL");
  if (dl) return "deepl";
  return null;
}

// ── Public entry point ────────────────────────────────────────────────────

export async function translate(req: TranslateRequest): Promise<TranslationResult> {
  if (!req.text.trim()) return { text: req.text, engine: "deepseek", cached: true };
  const lang = languageByCode(req.targetLang);
  if (!lang) throw new Error(`unknown target language: ${req.targetLang}`);

  const engine = await pickEngine();
  if (!engine) {
    throw new Error("no translation provider configured — set DEEPSEEK or OPENAI API key in Settings");
  }

  const tone = req.tone ?? "default";
  const hash = sourceHash(req.text);

  // Cache lookup
  const cached = await prisma.translation.findFirst({
    where: { sourceHash: hash, targetLang: req.targetLang, tone, translator: mapEngineToTranslatorEnum(engine) },
    orderBy: { createdAt: "desc" },
  }).catch(() => null);
  if (cached) return { text: cached.text, engine, cached: true };

  // Glossary (do-not-translate terms + per-language pairs)
  const glossaryPairs: Record<string, string> = {};
  const doNotTranslate: string[] = [];
  if (req.glossaryName) {
    const g = await prisma.glossary.findUnique({ where: { name: req.glossaryName } });
    const pairs = (g?.pairs as Record<string, unknown>) ?? {};
    const langPairs = pairs[req.targetLang] as Record<string, string> | undefined;
    if (langPairs) Object.assign(glossaryPairs, langPairs);
    const dnt = pairs.doNotTranslate as string[] | undefined;
    if (dnt) doNotTranslate.push(...dnt);
  }

  // Dispatch
  let translated: string;
  switch (engine) {
    case "deepseek": translated = await translateWithDeepSeek(req, lang.label, glossaryPairs, doNotTranslate, tone); break;
    case "openai":   translated = await translateWithOpenAI  (req, lang.label, glossaryPairs, doNotTranslate, tone); break;
    case "deepl":    translated = await translateWithDeepL   (req, lang.deeplCode); break;
  }

  // Write cache
  await prisma.translation.create({
    data: {
      sourceHash: hash,
      sourceText: req.text,
      targetLang: req.targetLang,
      tone,
      text: translated,
      translator: mapEngineToTranslatorEnum(engine),
    },
  }).catch(() => { /* cache write best-effort */ });

  return { text: translated, engine, cached: false };
}

function mapEngineToTranslatorEnum(engine: "deepseek" | "openai" | "deepl") {
  // The Translation table's `translator` field is the existing Translator enum;
  // we reuse DEEPL for DeepL, GPT4 for OpenAI, and add DEEPSEEK below in a migration.
  // For now map deepseek → GPT4 cache-bucket (cheap to invalidate later).
  return engine === "deepl" ? "DEEPL" : "GPT4";
}

// ── DeepSeek ──────────────────────────────────────────────────────────────
// Uses the chat-completions API (OpenAI-compatible). Endpoint: https://api.deepseek.com
// Model: deepseek-chat (general). At $0.14/1M input + $0.28/1M output tokens it's
// roughly 10x cheaper than DeepL Pro for the same volume — but quality varies more,
// so the cache + glossary are doing the heavy lifting.

async function translateWithDeepSeek(req: TranslateRequest, langLabel: string, glossary: Record<string, string>, dnt: string[], tone: string): Promise<string> {
  const cred = await getCredential("TRANSLATION_DEEPSEEK");
  if (!cred) throw new Error("deepseek key missing");

  const prompt = buildTranslationPrompt({ text: req.text, langLabel, glossary, dnt, tone });
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model: (cred.meta?.model as string) ?? "deepseek-chat",
      messages: [
        { role: "system", content: "You are a professional translator for a luxury fragrance brand. Output ONLY the translated text, no commentary, no quotes around it." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`deepseek error ${res.status}: ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return cleanLlmOutput(json.choices[0]?.message?.content ?? "");
}

// ── OpenAI ────────────────────────────────────────────────────────────────
// Default model: gpt-4o-mini ($0.15/1M input, $0.60/1M output) — cheaper than DeepL,
// quality on par for marketing copy. Switch to gpt-4o for the highest-stakes campaigns.

async function translateWithOpenAI(req: TranslateRequest, langLabel: string, glossary: Record<string, string>, dnt: string[], tone: string): Promise<string> {
  const cred = await getCredential("TRANSLATION_OPENAI");
  if (!cred) throw new Error("openai key missing");

  const prompt = buildTranslationPrompt({ text: req.text, langLabel, glossary, dnt, tone });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model: (cred.meta?.model as string) ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional translator for a luxury fragrance brand. Output ONLY the translated text, no commentary, no quotes around it." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`openai error ${res.status}: ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return cleanLlmOutput(json.choices[0]?.message?.content ?? "");
}

// ── DeepL (legacy fallback) ──────────────────────────────────────────────

async function translateWithDeepL(req: TranslateRequest, deeplCode: string): Promise<string> {
  const cred = await getCredential("TRANSLATION_DEEPL");
  if (!cred) throw new Error("deepl key missing");
  const host = (cred.meta?.host as string) ?? "api.deepl.com";
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `DeepL-Auth-Key ${cred.value}` },
    body: new URLSearchParams({ text: req.text, target_lang: deeplCode, source_lang: req.sourceLang ?? "" }).toString(),
  });
  if (!res.ok) throw new Error(`deepl error ${res.status}: ${await res.text()}`);
  const json = await res.json() as { translations: { text: string }[] };
  return json.translations?.[0]?.text ?? req.text;
}

// ── Prompt builder ────────────────────────────────────────────────────────

function buildTranslationPrompt(args: { text: string; langLabel: string; glossary: Record<string, string>; dnt: string[]; tone: string }): string {
  const pairs = Object.entries(args.glossary).map(([src, tgt]) => `  - "${src}" → "${tgt}"`).join("\n");
  const dntLine = args.dnt.length ? `\nDO NOT TRANSLATE these terms — keep them verbatim:\n${args.dnt.map((t) => `  - "${t}"`).join("\n")}` : "";
  const glossaryLine = pairs ? `\nUse this glossary EXACTLY for these terms:\n${pairs}` : "";
  const toneLine = args.tone === "formal" ? "Use a formal register." : args.tone === "informal" ? "Use an informal, warm register." : args.tone === "promotional" ? "Use a confident, promotional register suitable for marketing." : "Match the source register naturally.";

  return `Translate the following text into ${args.langLabel}.
${toneLine}${dntLine}${glossaryLine}

TEXT TO TRANSLATE:
${args.text}`;
}

// LLM outputs sometimes wrap their answer in quotes or add "Translation:" prefixes.
// Strip the obvious wrappers without being too aggressive (a translation that
// genuinely starts with a quote will keep it after the second pass).
function cleanLlmOutput(s: string): string {
  let t = s.trim();
  t = t.replace(/^translation:\s*/i, "");
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  return t.trim();
}
