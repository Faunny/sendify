// Gemini 2.5 Flash Image (Nano Banana) adapter for banner generation.
// Real implementation streams base64 image data and uploads to S3; we return a CDN URL.

import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");
    client = new GoogleGenerativeAI(key);
  }
  return client;
}

export type GenerateBannerArgs = {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "3:2" | "9:16";
  brandHints?: {
    palette?: string[];        // e.g. ["#0E0E0E", "#D4AF7A"]
    style?: string;            // "luxury minimal", "editorial", "playful"
    avoidText?: boolean;       // banners with on-image text translate badly across 22 langs
  };
};

export async function generateBanner(args: GenerateBannerArgs): Promise<{ base64: string; mimeType: string }> {
  if (!process.env.GEMINI_API_KEY) {
    // dev stub: 1×1 transparent PNG
    return { base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Z2QvWMAAAAASUVORK5CYII=", mimeType: "image/png" };
  }
  const model = getClient().getGenerativeModel({ model: "gemini-2.5-flash-image" });
  const styleHint = args.brandHints?.style ?? "luxury minimal";
  const paletteHint = args.brandHints?.palette?.length
    ? ` Palette: ${args.brandHints.palette.join(", ")}.`
    : "";
  const noTextHint = args.brandHints?.avoidText !== false
    ? " No text or typography in the image."
    : "";
  const prompt = `${args.prompt}. Style: ${styleHint}.${paletteHint}${noTextHint} Aspect ratio: ${args.aspectRatio ?? "3:2"}.`;
  const res = await model.generateContent(prompt);
  // The Gemini SDK returns inline data as base64 in parts[].inlineData.
  const part = res.response.candidates?.[0]?.content?.parts?.find((p) => "inlineData" in p) as
    | { inlineData: { data: string; mimeType: string } }
    | undefined;
  if (!part) throw new Error("Gemini returned no image");
  return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
}
