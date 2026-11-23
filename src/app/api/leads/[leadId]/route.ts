import { LeadStatus } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgencySession } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { leadId } = await params;
  const updated = await prisma.$transaction(async (transaction) => {
    const lead = await transaction.lead.findFirst({
      where: { id: leadId, agencyId: session.user.agencyId },
      select: { id: true, status: true },
    });
    if (!lead) return false;

    await transaction.lead.updateMany({
      where: { id: leadId, agencyId: session.user.agencyId },
      data: { status: parsed.data.status },
    });
    await transaction.auditLog.create({
      data: {
        agencyId: session.user.agencyId,
        actorUserId: session.user.id,
        action: "lead.status_changed",
        entityType: "lead",
        entityId: lead.id,
        payload: { from: lead.status, to: parsed.data.status },
      },
    });
    return true;
  });
  if (!updated) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ updated: true });
}
