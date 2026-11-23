import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  agencyName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(72),
});

function makeSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "agencia"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json({ error: "Origem da requisição inválida." }, { status: 403 });
    }
    if (originHost !== request.headers.get("host")) {
      return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confira os dados informados." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hash(parsed.data.password, 12);

  try {
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash,
        },
      });
      const agency = await transaction.agency.create({
        data: {
          name: parsed.data.agencyName,
          slug: makeSlug(parsed.data.agencyName),
          memberships: {
            create: { user: { connect: { id: user.id } }, role: "OWNER" },
          },
          botSettings: { create: {} },
        },
      });

      return agency.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este e-mail já possui cadastro." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ created: true }, { status: 201 });
}
