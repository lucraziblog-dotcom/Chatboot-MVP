import { z } from "zod";

const sendMessageResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

export async function sendWhatsAppText({
  phoneNumberId,
  accessToken,
  recipient,
  text,
}: {
  phoneNumberId: string;
  accessToken: string;
  recipient: string;
  text: string;
}) {
  if (!/^\d{5,30}$/.test(phoneNumberId) || !/^\d{6,20}$/.test(recipient)) {
    throw new Error("WhatsApp phone number identifiers are invalid.");
  }

  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v24.0";
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("WHATSAPP_GRAPH_API_VERSION must use the format vNN.N.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body: text, preview_url: false },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API returned HTTP ${response.status}.`);
  }

  const parsed = sendMessageResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("WhatsApp Cloud API returned an invalid send-message response.");
  }
  return parsed.data.messages[0].id;
}
