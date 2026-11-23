import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgencySession } from "@/lib/auth/tenant";
import { encryptWhatsAppAccessToken } from "@/lib/whatsapp/credentials";
import { prisma } from "@/lib/db";

const settingsSchema = z.object({
  phoneNumberId: z.union([z.string().regex(/^\d{5,30}$/), z.literal("")]),
  accessToken: z.string().trim().max(4096).optional(),
  instructions: z.string().trim().max(2000),
  handoffMessage: z.string().trim().min(2).max(500),
  autoReplyEnabled: z.boolean(),
});

function isAdmin(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function GET() {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const settings = await prisma.botSettings.findUnique({
    where: { agencyId: session.user.agencyId },
    select: {
      instructions: true,
      handoffMessage: true,
      autoReplyEnabled: true,
      whatsappPhoneNumberId: true,
      whatsappAccessTokenEncrypted: true,
    },
  });

  return NextResponse.json({
    settings: {
      phoneNumberId: settings?.whatsappPhoneNumberId ?? "",
      hasAccessToken: Boolean(settings?.whatsappAccessTokenEncrypted),
      instructions: settings?.instructions ?? "",
      handoffMessage: settings?.handoffMessage ?? "Vou encaminhar você para um consultor da nossa equipe.",
      autoReplyEnabled: settings?.autoReplyEnabled ?? false,
    },
    readiness: {
      openAI: Boolean(process.env.OPENAI_API_KEY),
      webhook: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
      encryption: Boolean(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY),
    },
    canManage: isAdmin(session.user.role),
  });
}

export async function PUT(request: Request) {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Somente proprietários e administradores podem alterar a integração." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confira o ID do número e os campos da configuração." }, { status: 400 });
  }

  const current = await prisma.botSettings.findUnique({
    where: { agencyId: session.user.agencyId },
    select: { id: true, whatsappAccessTokenEncrypted: true },
  });
  if (!current) {
    return NextResponse.json({ error: "As configurações da agência não foram encontradas." }, { status: 404 });
  }

  const newToken = parsed.data.accessToken?.trim();
  if (newToken && !process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Configure WHATSAPP_TOKEN_ENCRYPTION_KEY na Vercel antes de salvar o token." }, { status: 503 });
  }

  let encryptedToken = current.whatsappAccessTokenEncrypted;
  if (newToken) {
    try {
      encryptedToken = encryptWhatsAppAccessToken(newToken);
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Não foi possível proteger o token do WhatsApp.",
      }, { status: 503 });
    }
  }

  const phoneNumberId = parsed.data.phoneNumberId || null;
  if (parsed.data.autoReplyEnabled) {
    if (!phoneNumberId || !encryptedToken) {
      return NextResponse.json({ error: "Informe o ID do número e o token de acesso antes de ativar as respostas." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Configure OPENAI_API_KEY na Vercel antes de ativar o chatbot." }, { status: 503 });
    }
    if (!process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN) {
      return NextResponse.json({ error: "Configure WHATSAPP_APP_SECRET e WHATSAPP_VERIFY_TOKEN na Vercel antes de ativar o webhook." }, { status: 503 });
    }
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.botSettings.update({
        where: { agencyId: session.user.agencyId },
        data: {
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessTokenEncrypted: encryptedToken,
          instructions: parsed.data.instructions,
          handoffMessage: parsed.data.handoffMessage,
          autoReplyEnabled: parsed.data.autoReplyEnabled,
        },
      });
      await transaction.auditLog.create({
        data: {
          agencyId: session.user.agencyId,
          actorUserId: session.user.id,
          action: "whatsapp.settings.updated",
          entityType: "bot_settings",
          entityId: current.id,
          payload: { phoneNumberId, autoReplyEnabled: parsed.data.autoReplyEnabled },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este número do WhatsApp já está conectado a outra agência." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ saved: true, hasAccessToken: Boolean(encryptedToken) });
}
