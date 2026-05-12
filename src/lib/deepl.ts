// DeepL Pro adapter with translation cache.
// The cache (Prisma `Translation` model) is the single biggest cost lever:
// at 22 languages a single 2k-char campaign would cost ~$1.10 to translate uncached
// and ~$0 if 100% of strings already exist. Aim for ≥60% hit rate.

import { createHash } from "node:crypto";
import * as deepl from "deepl-node";
import { prisma } from "./db";
import { languageByCode } from "./languages";

let translator: deepl.Translator | null = null;
function getTranslator() {
  if (!translator) {
    const key = process.env.DEEPL_API_KEY;
    if (!key) throw new Error("DEEPL_API_KEY missing");
    translator = new deepl.Translator(key);
  }
  return translator;
}

export function sourceHash(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export type TranslateArgs = {
  text: string;
  targetLang: string; // BCP-47
  tone?: string;
  glossaryId?: string;
  sourceLang?: string;
};

export async function translate(args: TranslateArgs): Promise<string> {
  const lang = languageByCode(args.targetLang);
  if (!lang) throw new Error(`Unknown language: ${args.targetLang}`);
  const hash = sourceHash(args.text);
  const tone = args.tone ?? "default";

  // 1) cache lookup
  const cached = await prisma.translation.findFirst({
    where: { sourceHash: hash, targetLang: args.targetLang, tone },
    orderBy: { createdAt: "desc" },
  });
  if (cached) return cached.text;

  // 2) DeepL call (skipped if no key — return source text so dev UI still works)
  if (!process.env.DEEPL_API_KEY) return args.text;

  const result = await getTranslator().translateText(
    args.text,
    (args.sourceLang ?? null) as deepl.SourceLanguageCode | null,
    lang.deeplCode as deepl.TargetLanguageCode,
    { formality: tone === "formal" ? "more" : tone === "informal" ? "less" : "default" }
  );
  const translated = Array.isArray(result) ? result[0].text : result.text;

  await prisma.translation.create({
    data: {
      sourceHash: hash,
      sourceText: args.text,
      targetLang: args.targetLang,
      tone,
      text: translated,
      translator: "DEEPL",
      glossaryId: args.glossaryId,
    },
  });

  return translated;
}
