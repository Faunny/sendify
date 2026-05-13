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
  modelOverride?: string;
  referenceImageUrls?: string[];   // when set, hits /v1/images/edits so the
                                   // model composes a new scene USING these
                                   // real photos (the user's actual products)
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

  // Default to gpt-image-2 (latest); if the account doesn't have access to it
  // (404 model_not_found) automatically retry with gpt-image-1. The user can
  // pin a specific model in cred.meta.imageModel to skip the fallback, or pass
  // modelOverride per-call (used by the preview pack to go straight to -1).
  const requestedModel = args.modelOverride ?? (cred.meta?.imageModel as string) ?? "gpt-image-2";
  const callOpenAI = async (model: string) => fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
    body: JSON.stringify({
      model,
      prompt,
      size: sizeForAspect(args.aspectRatio),
      quality: args.quality ?? "medium",
      n: 1,
    }),
  });

  // EDIT PATH — when reference images are provided, use /v1/images/edits so the
  // model composes a new scene featuring the user's actual product photos
  // (e.g. real DIVAIN bottles arranged on warm sand at golden hour instead of
  // generic AI-invented bottles).
  if (args.referenceImageUrls && args.referenceImageUrls.length > 0) {
    return await runEditWithReferences(cred.value, requestedModel, prompt, args);
  }

  let res = await callOpenAI(requestedModel);
  if (!res.ok) {
    const body = await res.text();
    // If the requested model isn't available for this account, fall back to
    // gpt-image-1 once. Anything else (auth, quota, content policy) propagates.
    const looksLikeModelMissing = /model_not_found|does not exist|invalid_model/i.test(body) || (res.status === 404 && requestedModel !== "gpt-image-1");
    if (looksLikeModelMissing && requestedModel !== "gpt-image-1") {
      res = await callOpenAI("gpt-image-1");
      if (!res.ok) {
        const body2 = await res.text();
        throw new Error(`OpenAI image ${res.status} (after fallback): ${body2.slice(0, 240)}`);
      }
    } else {
      throw new Error(`OpenAI image ${res.status}: ${body.slice(0, 280)}`);
    }
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

// Download an image URL and return it as a Blob suitable for multipart upload.
async function fetchAsBlob(url: string, filenameHint: string): Promise<{ blob: Blob; filename: string }> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Failed to fetch reference image ${url}: ${r.status}`);
  const ab = await r.arrayBuffer();
  const ct = r.headers.get("content-type") ?? "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  return { blob: new Blob([ab], { type: ct }), filename: `${filenameHint}.${ext}` };
}

// Run /v1/images/edits with up to 4 product photos as references so the model
// composes a brand-new editorial scene FEATURING those actual products (real
// DIVAIN bottles arranged on warm sand, etc.) instead of inventing generic
// perfume props.
async function runEditWithReferences(
  apiKey: string,
  model: string,
  prompt: string,
  args: GenerateImageArgs,
): Promise<{ base64: string; mimeType: string }> {
  const refs = (args.referenceImageUrls ?? []).slice(0, 4); // OpenAI caps refs
  if (refs.length === 0) throw new Error("runEditWithReferences called with no refs");

  // Fetch all references in parallel — reused for both attempts (-2 then -1).
  const blobs = await Promise.all(refs.map((u, i) => fetchAsBlob(u, `ref-${i}`)));

  const callEdit = async (modelToUse: string) => {
    const form = new FormData();
    form.append("model", modelToUse);
    form.append("prompt", prompt);
    form.append("size", sizeForAspect(args.aspectRatio));
    form.append("quality", args.quality ?? "medium");
    form.append("n", "1");
    // OpenAI requires the bracket syntax for multi-image uploads. Sending
    // "image" multiple times triggers a 400 "Duplicate parameter" error.
    const fieldName = blobs.length > 1 ? "image[]" : "image";
    for (const { blob, filename } of blobs) form.append(fieldName, blob, filename);
    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: form,
    });
  };

  let res = await callEdit(model);
  if (!res.ok) {
    const body = await res.text();
    // gpt-image-2 might not be available on the account OR might not support
    // edits yet. Either way, fall back to gpt-image-1 once.
    const looksLikeModelMissing = /model_not_found|does not exist|invalid_model|not supported/i.test(body) || (res.status === 404 && model !== "gpt-image-1");
    if (looksLikeModelMissing && model !== "gpt-image-1") {
      res = await callEdit("gpt-image-1");
      if (!res.ok) {
        const body2 = await res.text();
        throw new Error(`OpenAI image edit ${res.status} (after fallback): ${body2.slice(0, 240)}`);
      }
    } else {
      throw new Error(`OpenAI image edit ${res.status}: ${body.slice(0, 280)}`);
    }
  }
  const json = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  if (first?.b64_json) return { base64: first.b64_json, mimeType: "image/png" };
  if (first?.url) {
    const imgRes = await fetch(first.url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType: imgRes.headers.get("content-type") ?? "image/png" };
  }
  throw new Error("OpenAI image edit returned no data");
}
