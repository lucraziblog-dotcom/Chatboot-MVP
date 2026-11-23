import { NextResponse } from "next/server";

import { getAgencySession } from "@/lib/auth/tenant";
import { generateTravelReply } from "@/lib/ai/travel-reply";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Somente proprietários e administradores podem testar a IA." }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Configure OPENAI_API_KEY na Vercel antes do teste." }, { status: 503 });
  }

  const recentTests = await prisma.auditLog.count({
    where: {
      agencyId: session.user.agencyId,
      actorUserId: session.user.id,
      action: "ai.test.requested",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentTests >= 3) {
    return NextResponse.json({ error: "Limite de 3 testes por hora atingido." }, { status: 429 });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  await prisma.auditLog.create({
    data: {
      agencyId: session.user.agencyId,
      actorUserId: session.user.id,
      action: "ai.test.requested",
      entityType: "ai",
      entityId: "manual-test",
      payload: { model },
    },
  });

  try {
    const result = await generateTravelReply({
      instructions: "Esta é uma mensagem fictícia para testar a integração. Não use dados reais.",
      history: [{
        direction: "INBOUND",
        content: "Olá! Quero planejar uma viagem de São Paulo para Salvador nas férias de julho para duas pessoas.",
      }],
      services: [],
      faqs: [],
    });

    return NextResponse.json({
      model,
      reply: result.reply,
      segment: result.segment,
      qualification: result.qualification,
      requestHuman: result.requestHuman,
    });
  } catch (error) {
    console.error(
      "AI integration test failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível testar a integração de IA.",
    }, { status: 502 });
  }
}
