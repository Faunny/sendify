// Pricing constants (as of 2026-Q2 — verify in AWS/DeepL/Gemini consoles before relying for production).
// Costs are returned in USD.

export const PRICING = {
  ses: {
    perEmail: 0.0001,           // $0.10 / 1,000
    perGbAttachment: 0.12,      // negligible if assets are CDN-linked, not embedded
  },
  deepl: {
    perMillionChars: 25.0,      // DeepL Pro Advanced tier
  },
  openai: {
    gpt4oInputPer1k: 0.0025,
    gpt4oOutputPer1k: 0.01,
  },
  gemini: {
    nanoBananaPerImage: 0.04,   // Gemini 2.5 Flash Image, approximate
  },
  aws: {
    s3PerGbMonth: 0.023,
    cloudfrontPerGb: 0.085,
    rdsHourly: 0.10,            // db.t4g.medium baseline
    ecsHourly: 0.0405,          // 0.5 vCPU / 1GB Fargate
    elasticacheHourly: 0.034,   // cache.t4g.micro
  },
};

export type CampaignCostEstimate = {
  recipients: number;
  languages: number;
  charsToTranslate: number;
  imagesGenerated: number;
  ses: number;
  deepl: number;
  gemini: number;
  total: number;
};

export function estimateCampaignCost(input: {
  recipients: number;
  languages: number;
  avgCharsPerLanguage?: number;
  cacheHitRate?: number;
  imagesGenerated?: number;
}): CampaignCostEstimate {
  const avgChars = input.avgCharsPerLanguage ?? 1800;
  const cacheHit = input.cacheHitRate ?? 0.6;
  const charsToTranslate = Math.round(
    avgChars * input.languages * (1 - cacheHit)
  );
  const imagesGenerated = input.imagesGenerated ?? 0;

  const ses = input.recipients * PRICING.ses.perEmail;
  const deepl = (charsToTranslate / 1_000_000) * PRICING.deepl.perMillionChars;
  const gemini = imagesGenerated * PRICING.gemini.nanoBananaPerImage;

  return {
    recipients: input.recipients,
    languages: input.languages,
    charsToTranslate,
    imagesGenerated,
    ses,
    deepl,
    gemini,
    total: ses + deepl + gemini,
  };
}

export function estimateMonthlyInfra(emailsPerMonth: number) {
  const ses = emailsPerMonth * PRICING.ses.perEmail;
  const awsFixed =
    PRICING.aws.rdsHourly * 24 * 30 +
    PRICING.aws.ecsHourly * 24 * 30 * 2 +
    PRICING.aws.elasticacheHourly * 24 * 30;
  return {
    ses,
    awsFixed,
    total: ses + awsFixed,
  };
}
