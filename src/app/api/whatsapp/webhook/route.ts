import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { processIncomingTextMessage } from "@/lib/whatsapp/process-incoming-message";

export const runtime = "nodejs";

const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        metadata: z.object({ phone_number_id: z.string().regex(/^\d{5,30}$/) }).passthrough(),
        contacts: z.array(z.object({
          wa_id: z.string(),
          profile: z.object({ name: z.string().optional() }).optional(),
        }).passthrough()).optional(),
        messages: z.array(z.object({
          id: z.string().min(1),
          from: z.string().regex(/^\d{6,20}$/),
          type: z.string(),
          text: z.object({ body: z.string().max(4096) }).optional(),
        }).passthrough()).optional(),
      }).passthrough(),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge || !safeEqual(token, verifyToken)) {
    return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
  }

  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Webhook signature verification is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!safeEqual(signature, expectedSignature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const parsed = webhookPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid WhatsApp webhook payload." }, { status: 400 });
  }
  if (parsed.data.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  try {
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages" || !change.value.messages) continue;

        for (const message of change.value.messages) {
          if (message.type !== "text" || !message.text?.body.trim()) continue;
          const contact = change.value.contacts?.find((item) => item.wa_id === message.from);
          await processIncomingTextMessage(change.value.metadata.phone_number_id, {
            id: message.id,
            from: message.from,
            text: message.text.body.trim(),
            customerName: contact?.profile?.name?.trim() || null,
          });
        }
      }
    }
  } catch (error) {
    console.error(
      "WhatsApp webhook processing failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Unable to process WhatsApp message." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
