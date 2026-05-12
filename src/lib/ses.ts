// Amazon SES adapter. Real implementation uses SESv2 SendEmail with a configuration set
// that ships engagement events to SNS → our /api/ses/events webhook. For now this is a thin
// scaffold that mirrors the production interface so the rest of the app can call it.

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

let client: SESv2Client | null = null;
function getClient() {
  if (!client) {
    client = new SESv2Client({
      region: process.env.AWS_REGION ?? "eu-west-1",
    });
  }
  return client;
}

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
  if (!process.env.AWS_ACCESS_KEY_ID) {
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

  const command = new SendEmailCommand({
    FromEmailAddress: args.from,
    Destination: { ToAddresses: [args.to] },
    ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
    ConfigurationSetName: args.configurationSet ?? process.env.SES_CONFIGURATION_SET,
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

  const res = await getClient().send(command);
  return { messageId: res.MessageId ?? "" };
}
