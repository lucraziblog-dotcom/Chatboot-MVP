import { LeadStatus, Prisma, TourismSegment } from "@/generated/prisma/client";

import { generateTravelReply } from "@/lib/ai/travel-reply";
import { prisma } from "@/lib/db";
import { decryptWhatsAppAccessToken } from "@/lib/whatsapp/credentials";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

type IncomingTextMessage = {
  id: string;
  from: string;
  text: string;
  customerName: string | null;
};

function isDuplicateMessage(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isHumanRequest(text: string) {
  return /\b(falar com (um )?(atendente|consultor|humano|pessoa)|atendimento humano|chamar (um )?(atendente|consultor)|quero uma pessoa)\b/i.test(text);
}

export async function processIncomingTextMessage(
  phoneNumberId: string,
  incoming: IncomingTextMessage,
) {
  const settings = await prisma.botSettings.findUnique({
    where: { whatsappPhoneNumberId: phoneNumberId },
    select: {
      agencyId: true,
      instructions: true,
      handoffMessage: true,
      autoReplyEnabled: true,
      whatsappAccessTokenEncrypted: true,
    },
  });
  if (!settings?.whatsappAccessTokenEncrypted) {
    throw new Error("No agency is configured for this WhatsApp phone number.");
  }

  const customerPhone = `+${incoming.from}`;
  const now = new Date();
  const { conversation, leadId } = await prisma.$transaction(async (transaction) => {
    let currentConversation = await transaction.conversation.upsert({
      where: {
        agencyId_customerPhone: {
          agencyId: settings.agencyId,
          customerPhone,
        },
      },
      update: {
        lastMessageAt: now,
        ...(incoming.customerName ? { customerName: incoming.customerName } : {}),
      },
      create: {
        agencyId: settings.agencyId,
        customerPhone,
        customerName: incoming.customerName,
        lastMessageAt: now,
      },
      select: { id: true, leadId: true, status: true },
    });

    if (currentConversation.status === "CLOSED") {
      currentConversation = await transaction.conversation.update({
        where: {
          agencyId_customerPhone: {
            agencyId: settings.agencyId,
            customerPhone,
          },
        },
        data: { status: "BOT" },
        select: { id: true, leadId: true, status: true },
      });
    }

    const lead = (currentConversation.leadId
      ? await transaction.lead.findUnique({
          where: {
            agencyId_id: {
              agencyId: settings.agencyId,
              id: currentConversation.leadId,
            },
          },
        })
      : null) ?? await transaction.lead.findFirst({
        where: { agencyId: settings.agencyId, phone: customerPhone },
      }) ?? await transaction.lead.create({
        data: {
          agencyId: settings.agencyId,
          name: incoming.customerName ?? customerPhone,
          phone: customerPhone,
          segment: TourismSegment.UNDEFINED,
          status: settings.autoReplyEnabled ? LeadStatus.QUALIFYING : LeadStatus.NEW,
        },
      });

    if (currentConversation.leadId !== lead.id) {
      await transaction.conversation.update({
        where: {
          agencyId_id: {
            agencyId: settings.agencyId,
            id: currentConversation.id,
          },
        },
        data: { leadId: lead.id },
      });
    }

    return { conversation: currentConversation, leadId: lead.id };
  });

  let inboundMessageId: string;
  try {
    const message = await prisma.message.create({
      data: {
        agencyId: settings.agencyId,
        conversationId: conversation.id,
        externalMessageId: incoming.id,
        direction: "INBOUND",
        content: incoming.text,
      },
      select: { id: true },
    });
    inboundMessageId = message.id;
  } catch (error) {
    if (!isDuplicateMessage(error)) throw error;
    const existing = await prisma.message.findUnique({
      where: {
        agencyId_externalMessageId: {
          agencyId: settings.agencyId,
          externalMessageId: incoming.id,
        },
      },
      select: { id: true },
    });
    if (!existing) throw error;
    inboundMessageId = existing.id;
  }

  const claimTime = new Date();
  const staleClaimBefore = new Date(claimTime.getTime() - 2 * 60 * 1000);
  const claim = await prisma.message.updateMany({
    where: {
      id: inboundMessageId,
      agencyId: settings.agencyId,
      OR: [
        { processingStatus: { in: ["RECEIVED", "FAILED"] } },
        { processingStatus: "PROCESSING", processingStartedAt: { lt: staleClaimBefore } },
      ],
    },
    data: { processingStatus: "PROCESSING", processingStartedAt: claimTime },
  });
  if (claim.count === 0) return { duplicate: true };

  try {
    if (!settings.autoReplyEnabled || conversation.status === "HUMAN") {
      await prisma.message.update({
        where: { id: inboundMessageId },
        data: { processingStatus: "PROCESSED", processingStartedAt: null },
      });
      return { duplicate: false, replied: false };
    }

    const accessToken = decryptWhatsAppAccessToken(settings.whatsappAccessTokenEncrypted);
    let handoff = isHumanRequest(incoming.text);
    let replyText = settings.handoffMessage;

    if (!handoff) {
      const [history, services, faqs] = await Promise.all([
        prisma.message.findMany({
          where: { agencyId: settings.agencyId, conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { direction: true, content: true },
        }),
        prisma.agencyService.findMany({
          where: { agencyId: settings.agencyId, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 30,
          select: { name: true, description: true, segment: true },
        }),
        prisma.fAQ.findMany({
          where: { agencyId: settings.agencyId, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 30,
          select: { question: true, answer: true },
        }),
      ]);
      const aiHistory: Array<{ direction: "INBOUND" | "OUTBOUND"; content: string }> = [];
      for (const message of history.reverse()) {
        if (message.direction === "INBOUND" || message.direction === "OUTBOUND") {
          aiHistory.push({ direction: message.direction, content: message.content });
        }
      }

      const generated = await generateTravelReply({
        instructions: settings.instructions,
        history: aiHistory,
        services,
        faqs,
      });
      handoff = generated.requestHuman;
      replyText = handoff ? settings.handoffMessage : generated.reply;
      await prisma.lead.update({
        where: {
          agencyId_id: {
            agencyId: settings.agencyId,
            id: leadId,
          },
        },
        data: {
          segment: generated.segment,
          qualification: generated.qualification,
          ...(generated.summary ? { serviceSummary: generated.summary } : {}),
        },
      });
    }

    const externalMessageId = await sendWhatsAppText({
      phoneNumberId,
      accessToken,
      recipient: incoming.from,
      text: replyText,
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.message.create({
        data: {
          agencyId: settings.agencyId,
          conversationId: conversation.id,
          externalMessageId,
          direction: "OUTBOUND",
          content: replyText,
          processingStatus: "PROCESSED",
        },
      });
      await transaction.conversation.update({
        where: {
          agencyId_id: {
            agencyId: settings.agencyId,
            id: conversation.id,
          },
        },
        data: { status: handoff ? "HUMAN" : "BOT", lastMessageAt: new Date() },
      });
      await transaction.lead.update({
        where: {
          agencyId_id: {
            agencyId: settings.agencyId,
            id: leadId,
          },
        },
        data: { status: handoff ? LeadStatus.WAITING_HUMAN : LeadStatus.QUALIFYING },
      });
      await transaction.message.update({
        where: { id: inboundMessageId },
        data: { processingStatus: "PROCESSED", processingStartedAt: null },
      });
    });

    return { duplicate: false, replied: true };
  } catch (error) {
    await prisma.message.update({
      where: { id: inboundMessageId },
      data: { processingStatus: "FAILED", processingStartedAt: null },
    });
    throw error;
  }
}
