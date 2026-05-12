// SES → SNS event webhook.
// SNS delivers JSON envelopes for Delivery, Bounce, Complaint, Open and Click events.
// We update the matching Send row and, on hard bounces / complaints, add to the suppression list.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type SnsMessage = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  Message: string;
  SubscribeURL?: string;
};

type SesEvent = {
  eventType: "Delivery" | "Bounce" | "Complaint" | "Open" | "Click" | "Send" | "Reject";
  mail: { messageId: string; destination: string[]; tags?: Record<string, string[]> };
  bounce?: { bounceType: "Permanent" | "Transient" | "Undetermined"; bouncedRecipients: { emailAddress: string }[] };
  complaint?: { complainedRecipients: { emailAddress: string }[] };
};

export async function POST(req: Request) {
  const body = (await req.json()) as SnsMessage;

  if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
    await fetch(body.SubscribeURL);
    return NextResponse.json({ ok: true });
  }

  const event = JSON.parse(body.Message) as SesEvent;
  const send = await prisma.send.findUnique({ where: { messageId: event.mail.messageId } });
  if (!send) return NextResponse.json({ ok: true, note: "no matching send" });

  switch (event.eventType) {
    case "Delivery":
      await prisma.send.update({ where: { id: send.id }, data: { status: "DELIVERED", sentAt: new Date() } });
      break;
    case "Open":
      await prisma.send.update({ where: { id: send.id }, data: { status: "OPENED", openedAt: send.openedAt ?? new Date() } });
      break;
    case "Click":
      await prisma.send.update({ where: { id: send.id }, data: { status: "CLICKED", clickedAt: send.clickedAt ?? new Date() } });
      break;
    case "Bounce": {
      const isHard = event.bounce?.bounceType === "Permanent";
      await prisma.send.update({ where: { id: send.id }, data: { status: "BOUNCED", bouncedAt: new Date() } });
      if (isHard && event.bounce) {
        for (const r of event.bounce.bouncedRecipients) {
          await prisma.suppression.upsert({
            where: { email: r.emailAddress },
            update: {},
            create: { email: r.emailAddress, reason: "BOUNCE_HARD", source: "ses:bounce" },
          });
        }
      }
      break;
    }
    case "Complaint":
      await prisma.send.update({ where: { id: send.id }, data: { status: "COMPLAINED" } });
      if (event.complaint) {
        for (const r of event.complaint.complainedRecipients) {
          await prisma.suppression.upsert({
            where: { email: r.emailAddress },
            update: {},
            create: { email: r.emailAddress, reason: "COMPLAINT", source: "ses:complaint" },
          });
        }
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
