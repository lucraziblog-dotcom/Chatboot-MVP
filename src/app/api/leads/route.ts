import { LeadStatus, TourismSegment } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgencySession } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  segment: z.nativeEnum(TourismSegment),
  serviceSummary: z.string().trim().max(500).optional(),
});

const listLeadsSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  segment: z.nativeEnum(TourismSegment).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).max(64).optional(),
});

const pageSize = 30;

export async function GET(request: Request) {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsedFilters = listLeadsSchema.safeParse({
    status: searchParams.get("status") || undefined,
    segment: searchParams.get("segment") || undefined,
    q: searchParams.get("q") || undefined,
    cursor: searchParams.get("cursor") || undefined,
  });
  if (!parsedFilters.success) {
    return NextResponse.json({ error: "Filtros de busca inválidos." }, { status: 400 });
  }
  const { status, segment, q, cursor } = parsedFilters.data;

  const rows = await prisma.lead.findMany({
    where: {
      agencyId: session.user.agencyId,
      ...(status ? { status } : {}),
      ...(segment ? { segment } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      segment: true,
      status: true,
      serviceSummary: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > pageSize;
  const leads = hasMore ? rows.slice(0, pageSize) : rows;
  return NextResponse.json({
    leads,
    hasMore,
    nextCursor: hasMore ? leads[leads.length - 1]?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  const session = await getAgencySession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confira os campos obrigatórios do lead." }, { status: 400 });
  }

  const lead = await prisma.$transaction(async (transaction) => {
    const created = await transaction.lead.create({
      data: {
        agencyId: session.user.agencyId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        segment: parsed.data.segment,
        serviceSummary: parsed.data.serviceSummary || null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        segment: true,
        status: true,
        serviceSummary: true,
        updatedAt: true,
      },
    });
    await transaction.auditLog.create({
      data: {
        agencyId: session.user.agencyId,
        actorUserId: session.user.id,
        action: "lead.created",
        entityType: "lead",
        entityId: created.id,
        payload: { segment: created.segment },
      },
    });
    return created;
  });

  return NextResponse.json({ lead }, { status: 201 });
}
