import { TourismSegment } from "@/generated/prisma/client";
import { z } from "zod";

const qualificationSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  departureDate: z.string().nullable(),
  returnDate: z.string().nullable(),
  passengers: z.string().nullable(),
  preferences: z.string().nullable(),
  excursionDate: z.string().nullable(),
  participants: z.string().nullable(),
  boardingPoint: z.string().nullable(),
  tour: z.string().nullable(),
  lodging: z.string().nullable(),
  transfer: z.string().nullable(),
}).strict();

const travelReplySchema = z.object({
  reply: z.string().trim().min(1).max(1000),
  segment: z.nativeEnum(TourismSegment),
  qualification: qualificationSchema,
  summary: z.string().max(500).nullable(),
  requestHuman: z.boolean(),
}).strict();

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    segment: { type: "string", enum: Object.values(TourismSegment) },
    qualification: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.keys(qualificationSchema.shape).map((field) => [
          field,
          { type: ["string", "null"] },
        ]),
      ),
      required: Object.keys(qualificationSchema.shape),
    },
    summary: { type: ["string", "null"] },
    requestHuman: { type: "boolean" },
  },
  required: ["reply", "segment", "qualification", "summary", "requestHuman"],
};

export type TravelReply = z.infer<typeof travelReplySchema>;

function getChatCompletionsUrl() {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("OPENAI_BASE_URL must be a valid URL.");
  }

  const isLocalHttp =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("OPENAI_BASE_URL must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("OPENAI_BASE_URL must not contain credentials, query parameters, or a fragment.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
  return url.toString();
}

export async function generateTravelReply({
  instructions,
  history,
  services,
  faqs,
}: {
  instructions: string;
  history: Array<{ direction: "INBOUND" | "OUTBOUND"; content: string }>;
  services: Array<{ name: string; description: string | null; segment: TourismSegment }>;
  faqs: Array<{ question: string; answer: string }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const systemPrompt = [
    "Você é o assistente de pré-atendimento de uma agência de turismo. Responda em português brasileiro, com cordialidade e objetividade.",
    "Qualifique o interesse sem confirmar preços, disponibilidade, reservas, emissão ou qualquer condição não informada pela agência.",
    "Use somente os serviços, perguntas frequentes e instruções fornecidos. Se não souber, diga que um consultor confirmará.",
    "Faça no máximo uma pergunta clara por resposta. Preencha a qualificação apenas com dados que a pessoa informou; use null para o que ainda não sabe.",
    "Classifique o interesse como AIR, EXCURSION, RECEPTIVE ou UNDEFINED. Marque requestHuman como true se a pessoa pedir atendimento humano ou se a situação exigir um consultor.",
    "Retorne somente um objeto JSON válido com as chaves reply, segment, qualification, summary e requestHuman, sem bloco Markdown.",
    `Instruções da agência: ${instructions || "Nenhuma instrução adicional."}`,
    `Serviços aprovados: ${JSON.stringify(services)}`,
    `Perguntas frequentes aprovadas: ${JSON.stringify(faqs)}`,
  ].join("\n\n");

  const response = await fetch(getChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "travel_pre_attendance",
          strict: true,
          schema: jsonSchema,
        },
      },
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((message) => ({
          role: message.direction === "INBOUND" ? "user" as const : "assistant" as const,
          content: message.content,
        })),
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned HTTP ${response.status}.`);
  }

  const payload = responseSchema.safeParse(await response.json());
  if (!payload.success) throw new Error("OpenAI API returned an invalid response.");

  const content = payload.data.choices[0].message.content;
  if (!content) throw new Error("OpenAI API returned an empty response.");

  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new Error("OpenAI API returned malformed JSON.");
  }

  const result = travelReplySchema.safeParse(decoded);
  if (!result.success) throw new Error("OpenAI response did not match the travel qualification format.");
  return result.data;
}
