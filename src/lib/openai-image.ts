// OpenAI GPT Image 1 adapter — the natively-multimodal image model OpenAI released
// in April 2025. Better than DALL-E 3 on text-free brand work and roughly the same
// price tier as Gemini Flash Image. The key lives in ProviderCredential
// (provider=IMAGE_OPENAI), separate from the chat-completions key so we don't
// burn the same quota for templates and images.

import { getCredential } from "./credentials";

export type GenerateImageArgs = {
  prompt: string;
  aspectRatio?: "1:1" | "3:2" | "2:3";
  brandHints?: {
    palette?: string[];
    style?: string;
    avoidText?: boolean;
  };
  quality?: "low" | "medium" | "high";
};

// Map our aspect-ratio tokens to gpt-image-1's accepted size strings.
function sizeForAspect(aspectRatio: "1:1" | "3:2" | "2:3" | undefined): "1024x1024" | "1536x1024" | "1024x1536" {
  if (aspectRatio === "3:2") return "1536x1024";
  if (aspectRatio === "2:3") return "1024x1536";
  return "1024x1024";
}

export async function generateImageWithOpenAI(args: GenerateImageArgs): Promise<{ base64: string; mimeType: string }> {
  // We use the dedicated IMAGE_OPENAI slot so users can keep image-gen and
  // chat-completions on different keys / orgs / billing.
  const cred = (await getCredential("IMAGE_OPENAI")) ?? (await getCredential("TRANSLATION_OPENAI"));
  if (!cred) throw new Error("OpenAI image key not configured (IMAGE_OPENAI or TRANSLATION_OPENAI)");

  const styleHint = args.brandHints?.style ?? "luxury minimal";
  const paletteHint = args.brandHints?.palette?.length
    ? ` Palette guidance: ${args.brandHints.palette.join(", ")}.`
    : "";
  const noTextRule = args.brandHints?.avoidText === false
    ? ""
    : ` STRICT RULE: the image must contain ZERO text, ZERO letters, ZERO numbers, ZERO prices, ZERO percentages, ZERO dates, ZERO logos, ZERO watermarks, ZERO captions, ZERO signage of any kind. Pure photographic content only — people, objects, nature, surfaces, textures.`;
  const subject = args.prompt.replace(/^(photo of |photograph of |image of )/i, "");
  const prompt = `Photograph: ${subject}. Style: ${styleHint}.${paletteHint}${noTextRule} The composition must be editorial, clean, and suitable as a hero banner background with text overlaid LATER in the email template.`;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model: (cred.meta?.imageModel as string) ?? "gpt-image-1",
      prompt,
      size: sizeForAspect(args.aspectRatio),
      quality: args.quality ?? "medium",
      n: 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image ${res.status}: ${body.slice(0, 280)}`);
  }
  const json = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  if (first?.b64_json) return { base64: first.b64_json, mimeType: "image/png" };
  if (first?.url) {
    // Fallback path if the account returns URL mode (older DALL-E behaviour).
    const imgRes = await fetch(first.url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType: imgRes.headers.get("content-type") ?? "image/png" };
  }
  throw new Error("OpenAI image returned no data");
}
