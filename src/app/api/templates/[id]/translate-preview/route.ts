// POST /api/templates/[id]/translate-preview
//
// Translate every text node of an MJML document into the requested language
// using whichever LLM is configured (DeepSeek preferred, OpenAI fallback) and
// return the translated MJML so the editor can render a per-language preview.
//
// This is a STATELESS translation — it doesn't persist anywhere. Used to let
// the user flip through "what does this email look like in French / German /
// Italian" before approving a real send.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCredential } from "@/lib/credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const LANG_LABELS: Record<string, string> = {
  "es-ES": "Spanish (Spain)",  "es-MX": "Spanish (Mexico)",
  "en-GB": "English (UK)",     "en-US": "English (US)",
  "fr-FR": "French (France)",
  "de-DE": "German",
  "it-IT": "Italian",
  "pt-PT": "Portuguese (PT)",  "pt-BR": "Portuguese (BR)",
  "nl-NL": "Dutch",
  "pl-PL": "Polish",
  "sv-SE": "Swedish",
  "da-DK": "Danish",
  "fi-FI": "Finnish",
  "no-NO": "Norwegian",
  "cs-CZ": "Czech",
  "ro-RO": "Romanian",
  "hu-HU": "Hungarian",
  "bg-BG": "Bulgarian",
  "el-GR": "Greek",
  "sk-SK": "Slovak",
  "sl-SI": "Slovenian",
};

export async function POST(req: Request) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as { mjml?: string; targetLang?: string; sourceLang?: string }));
  const mjml = String(body.mjml ?? "");
  const targetLang = String(body.targetLang ?? "");
  const sourceLang = String(body.sourceLang ?? "es-ES");
  if (!mjml.includes("<mjml")) return NextResponse.json({ ok: false, error: "mjml required" }, { status: 400 });
  if (!LANG_LABELS[targetLang]) return NextResponse.json({ ok: false, error: `unsupported target language: ${targetLang}` }, { status: 400 });
  if (targetLang === sourceLang) return NextResponse.json({ ok: true, translatedMjml: mjml, note: "source = target, no translation needed" });

  const openai   = await getCredential("TRANSLATION_OPENAI");
  const deepseek = await getCredential("TRANSLATION_DEEPSEEK");
  const cred = openai ?? deepseek;
  if (!cred) return NextResponse.json({ ok: false, error: "no LLM configured" }, { status: 400 });

  const useOpenai = !!openai;
  const url = useOpenai ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
  const model = useOpenai ? ((cred.meta?.model as string) ?? "gpt-4o-mini") : ((cred.meta?.model as string) ?? "deepseek-chat");

  // Strategy: send the whole MJML to the LLM and ask it to translate ONLY the
  // visible text nodes (between tags), preserving every attribute, tag name
  // and URL. Cheaper + more consistent than parsing the DOM ourselves.
  const system = `You translate copy in MJML email templates from ${LANG_LABELS[sourceLang]} into ${LANG_LABELS[targetLang]}.
Rules:
- Translate ONLY the visible text content inside tags (mj-text, mj-button labels, alt= attributes if natural-language).
- Preserve ALL tag names, attribute names, attribute values that look like URLs / hex colors / sizes / pixel values.
- Preserve the structure exactly — DO NOT remove/add tags, attributes, whitespace, or change indentation.
- Preserve brand names: "divain", "divain.", product handles (e.g. divain.832), brand pillar names (PARFUMS, CARE, HOME, RITUAL).
- Adapt prices to local conventions only if the source includes them naturally; otherwise leave numbers untouched.
- Keep tone: warm, refined, editorial. No emojis. No "click here" — use the language-appropriate equivalent of "Discover" / "Shop" etc.
Return ONLY the translated MJML, no commentary, no markdown fences.`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: mjml },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: `LLM ${res.status}: ${txt.slice(0, 240)}` }, { status: 502 });
    }
    const json = await res.json() as { choices: { message: { content: string } }[] };
    let translated = json.choices[0]?.message?.content?.trim() ?? "";
    translated = translated.replace(/^```(?:mjml|html|xml)?\s*/i, "").replace(/```$/i, "").trim();
    if (!translated.includes("<mjml")) {
      return NextResponse.json({ ok: false, error: "LLM did not return valid MJML" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, translatedMjml: translated, model });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "translation failed" }, { status: 500 });
  }
}
