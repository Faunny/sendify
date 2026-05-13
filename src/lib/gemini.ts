// Gemini 2.5 Flash Image (a.k.a. Nano Banana) adapter for banner generation.
//
// Why Gemini for this: gemini-2.5-flash-image is the strongest open production
// model for preserving REFERENCE OBJECTS — when you pass it a product photo
// + a scene description, it composes a new image where the product is kept
// pixel-faithful (label, shape, glass color). gpt-image-2/edits invents bottle
// designs regardless of references, which is why we route bottle-in-scene
// generations here first.
//
// The API key lives in ProviderCredential (provider=IMAGE_GEMINI), not in env.

import { getCredential } from "./credentials";

export type GenerateBannerArgs = {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "3:2" | "9:16";
  brandHints?: {
    palette?: string[];        // ["#0E0E0E", "#D99425"]
    style?: string;            // "luxury minimal" etc.
    avoidText?: boolean;       // true by default — text in banners breaks 22-lang fan-out
  };
  // Product photos to inject into the scene. The model composes a new image
  // that preserves the objects in these images (label, shape, color, cap)
  // while building the surrounding scene from the prompt.
  referenceImageUrls?: string[];
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
  // NEVER bake text into the image — the same image is reused across 22-language
  // translations. Letters, numbers, prices, percentages, dates, brand names and
  // logos must all live in the surrounding MJML where they can be translated.
  const noTextRule = args.brandHints?.avoidText === false
    ? ""
    : ` STRICT RULE: the image must contain ZERO text, ZERO letters, ZERO numbers,
ZERO prices, ZERO percentages, ZERO dates, ZERO logos, ZERO watermarks, ZERO
captions, ZERO signage. Pure photographic content only — people, objects,
nature, surfaces, textures. If you cannot honour this rule, return an error.`;

  const refUrls = (args.referenceImageUrls ?? []).slice(0, 4);
  const refsBlock = refUrls.length > 0
    ? ` REFERENCE IMAGES ATTACHED: you have ${refUrls.length === 1 ? "1 reference image" : `${refUrls.length} reference images`} of the actual product. CRITICAL: the product in the final image must look EXACTLY like the reference — preserve the bottle/object's exact shape, glass color, cap design, label, proportions, and any branding visible on it. Do NOT redesign, restyle, or reinterpret the product. Place it naturally into the scene as if photographed there with the rest of the composition built around it.`
    : "";
  // Phrasing matters: Gemini honours negatives best when stated as part of the
  // subject description rather than as a separate constraint paragraph.
  const subject = args.prompt.replace(/^(photo of |photograph of |image of )/i, "");
  const promptText = `Photograph: ${subject}. Style: ${styleHint}.${paletteHint}${refsBlock}${noTextRule} Aspect ratio: ${args.aspectRatio ?? "3:2"}. The composition must be clean, editorial, and suitable as a hero banner background with text overlaid LATER in the email template.`;

  // Build the multimodal parts array: prompt text first, then each reference
  // image as inlineData. The model uses these to constrain the product
  // appearance.
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: promptText },
  ];
  for (const url of refUrls) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      const base64 = Buffer.from(ab).toString("base64");
      const mimeType = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      parts.push({ inlineData: { mimeType, data: base64 } });
    } catch {
      // Reference fetch failures shouldn't kill the generation — just continue
      // without that ref. The prompt still mentions "reference attached" but
      // the model will fall back to its own product synthesis.
    }
  }

  // Direct REST call (no SDK) so we can read the key dynamically per request.
  const model = (cred.meta?.model as string) ?? "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cred.value}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
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
