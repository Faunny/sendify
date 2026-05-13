// Amazon SES adapter. Real implementation uses SESv2 SendEmail with a configuration set
// that ships engagement events to SNS → our /api/ses/events webhook.
//
// Credentials are loaded from the credential store (encrypted at rest) — Access Key ID
// in `value`, secret + region in `meta`. Falls back to AWS_* env vars for local dev.

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getCredential } from "./credentials";

let cached: { client: SESv2Client; loadedAt: number } | null = null;
const CLIENT_TTL_MS = 30_000;

async function getClient(): Promise<SESv2Client> {
  if (cached && Date.now() - cached.loadedAt < CLIENT_TTL_MS) return cached.client;

  const cred = await getCredential("AWS_SES");
  const accessKeyId     = cred?.value ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = (cred?.meta?.secret as string | undefined) ?? process.env.AWS_SECRET_ACCESS_KEY;
  const region          = (cred?.meta?.region as string | undefined) ?? process.env.AWS_REGION ?? "eu-west-1";

  const client = new SESv2Client({
    region,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
  cached = { client, loadedAt: Date.now() };
  return client;
}

// Reset cache when the user updates the credential — called from the API route.
export function invalidateSesClient() { cached = null; }

export type SendArgs = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  configurationSet?: string;
  tags?: { name: string; value: string }[];
  replyTo?: string;
  // ListUnsubscribe header value (RFC 8058 one-click)
  listUnsubscribe?: { url: string; mailto?: string };
};

export async function sendEmail(args: SendArgs) {
  const cred = await getCredential("AWS_SES");
  if (!cred && !process.env.AWS_ACCESS_KEY_ID) {
    // dev mode: don't actually hit SES
    return { messageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  const headers: { Name: string; Value: string }[] = [];
  if (args.listUnsubscribe) {
    const parts = [`<${args.listUnsubscribe.url}>`];
    if (args.listUnsubscribe.mailto) parts.push(`<mailto:${args.listUnsubscribe.mailto}>`);
    headers.push({ Name: "List-Unsubscribe", Value: parts.join(", ") });
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" });
  }

  const requestedConfigSet = args.configurationSet ?? (cred?.meta?.configurationSet as string | undefined) ?? process.env.SES_CONFIGURATION_SET;

  const buildCommand = (configSetName: string | undefined) => new SendEmailCommand({
    FromEmailAddress: args.from,
    Destination: { ToAddresses: [args.to] },
    ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
    ConfigurationSetName: configSetName,
    EmailTags: args.tags?.map((t) => ({ Name: t.name, Value: t.value })),
    Content: {
      Simple: {
        Subject: { Data: args.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: args.html, Charset: "UTF-8" },
          Text: args.text ? { Data: args.text, Charset: "UTF-8" } : undefined,
        },
        Headers: headers.length ? headers : undefined,
      },
    },
  });

  const client = await getClient();
  try {
    const res = await client.send(buildCommand(requestedConfigSet));
    return { messageId: res.MessageId ?? "" };
  } catch (e) {
    // If SES rejects the configuration set (most common: the env var pointed
    // to a set that was never created in AWS) retry without it. Engagement-
    // tracking event publishing simply won't happen, but the email goes out.
    // Real error from SES looks like: "Configuration set <name> does not exist."
    const msg = e instanceof Error ? e.message : "";
    const configSetMissing = /configuration set.*does not exist|ConfigurationSetDoesNotExist/i.test(msg);
    if (requestedConfigSet && configSetMissing) {
      console.warn(`[ses] configuration set "${requestedConfigSet}" missing — retrying send without it`);
      const res = await client.send(buildCommand(undefined));
      return { messageId: res.MessageId ?? "" };
    }
    throw e;
  }
}
