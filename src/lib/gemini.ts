// Gemini 2.5 Flash Image (a.k.a. Nano Banana) adapter for banner generation.
//
// The API key lives in ProviderCredential (provider=IMAGE_GEMINI), not in env. The Settings
// UI is the only writer. Swap providers (DALL-E via OpenAI) by disabling this row and
// enabling the OpenAI image row. Same banner pipeline, different engine.

import { getCredential } from "./credentials";

export type GenerateBannerArgs = {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "3:2" | "9:16";
  brandHints?: {
    palette?: string[];        // ["#0E0E0E", "#D99425"]
    style?: string;            // "luxury minimal" etc.
    avoidText?: boolean;       // true by default — text in banners breaks 22-lang fan-out
  };
};

export async function generateBanner(args: GenerateBannerArgs): Promise<{ base64: string; mimeType: string }> {
  const cred = await getCredential("IMAGE_GEMINI");
  if (!cred) {
    throw new Error("Gemini API key not configured. Set it in Settings → Integrations.");
  }

  const styleHint = args.brandHints?.style ?? "luxury minimal";
  const paletteHint = args.brandHints?.palette?.length
    ? ` Palette: ${args.brandHints.palette.join(", ")}.`
    : "";
  const noTextHint = args.brandHints?.avoidText !== false
    ? " No text or typography in the image."
    : "";
  const prompt = `${args.prompt}. Style: ${styleHint}.${paletteHint}${noTextHint} Aspect ratio: ${args.aspectRatio ?? "3:2"}.`;

  // Direct REST call (no SDK) so we can read the key dynamically per request.
  const model = (cred.meta?.model as string) ?? "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cred.value}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>;
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => "inlineData" in p);
  if (!part?.inlineData) throw new Error("Gemini returned no image — check prompt or quota");
  return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
}
