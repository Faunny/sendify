// Banner image provider with automatic fallback.
//
// Order: IMAGE_OPENAI (gpt-image-1) → IMAGE_GEMINI (Flash Image). The first
// configured engine wins. If it fails (429, 5xx) we automatically try the next
// engine so a quota hit on one doesn't kill the campaign.

import { getCredential } from "./credentials";
import { generateBanner as generateBannerGemini } from "./gemini";
import { generateImageWithOpenAI } from "./openai-image";

export type BannerArgs = {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "3:2" | "9:16";
  brandHints?: {
    palette?: string[];
    style?: string;
    avoidText?: boolean;
  };
  quality?: "low" | "medium" | "high";
  preferredModel?: string;          // pin gpt-image-1 to skip the gpt-image-2 fallback dance
  referenceImageUrls?: string[];    // real product photos to compose into the scene
};

export type BannerResult = {
  base64: string;
  mimeType: string;
  provider: "openai-image" | "gemini-flash-image";
};

function mapAspect(aspectRatio: BannerArgs["aspectRatio"]): "1:1" | "3:2" | "2:3" {
  if (aspectRatio === "3:2" || aspectRatio === "16:9") return "3:2";
  if (aspectRatio === "9:16") return "2:3";
  return "1:1";
}

export async function generateBannerAny(args: BannerArgs): Promise<BannerResult> {
  const errors: string[] = [];
  const hasOpenai = !!(await getCredential("IMAGE_OPENAI") ?? await getCredential("TRANSLATION_OPENAI"));
  const hasGemini = !!(await getCredential("IMAGE_GEMINI"));

  const hasRefs = (args.referenceImageUrls ?? []).length > 0;

  // When references are provided we route to Gemini FIRST. Gemini 2.5 Flash
  // Image (Nano Banana) preserves reference-object appearance much better than
  // gpt-image-2/edits, which has a habit of inventing bottle designs even when
  // shown a reference. Without references, OpenAI gpt-image-2 produces nicer
  // model photography on average, so we keep that as the default.
  const order: Array<"gemini" | "openai"> = hasRefs ? ["gemini", "openai"] : ["openai", "gemini"];

  for (const provider of order) {
    if (provider === "openai" && hasOpenai) {
      try {
        const img = await generateImageWithOpenAI({
          prompt: args.prompt,
          aspectRatio: mapAspect(args.aspectRatio),
          brandHints: args.brandHints,
          quality: args.quality ?? "medium",
          modelOverride: args.preferredModel,
          referenceImageUrls: args.referenceImageUrls,
        });
        return { ...img, provider: "openai-image" };
      } catch (e) {
        errors.push(`openai: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    if (provider === "gemini" && hasGemini) {
      try {
        const img = await generateBannerGemini({
          prompt: args.prompt,
          aspectRatio: args.aspectRatio,
          brandHints: args.brandHints,
          referenceImageUrls: args.referenceImageUrls,
        });
        return { ...img, provider: "gemini-flash-image" };
      } catch (e) {
        errors.push(`gemini: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }

  if (!hasOpenai && !hasGemini) {
    throw new Error("No image provider configured (IMAGE_OPENAI or IMAGE_GEMINI).");
  }
  throw new Error(`All image providers failed · ${errors.join(" · ")}`);
}
