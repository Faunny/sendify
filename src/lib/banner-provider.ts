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
  // Force a specific provider as the first attempt regardless of refs. When
  // unset we use the auto-routing (Gemini first if refs exist, OpenAI first
  // otherwise). The other provider stays as a quota-failure fallback.
  preferredProvider?: "openai" | "gemini";
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

  // Auto-routing default: with refs → Gemini first (preserves bottles better);
  // without refs → OpenAI first (nicer model shots). preferredProvider lets
  // the caller override (e.g. refill-asset-pool pins OpenAI gpt-image-2).
  const autoOrder: Array<"gemini" | "openai"> = hasRefs ? ["gemini", "openai"] : ["openai", "gemini"];
  const order: Array<"gemini" | "openai"> = args.preferredProvider
    ? [args.preferredProvider, args.preferredProvider === "openai" ? "gemini" : "openai"]
    : autoOrder;

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
