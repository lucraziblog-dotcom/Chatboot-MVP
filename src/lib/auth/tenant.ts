import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export async function getAgencySession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.agencyId) return null;

  const membership = await prisma.membership.findUnique({
    where: {
      agencyId_userId: {
        agencyId: session.user.agencyId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!membership) return null;

  return {
    ...session,
    user: { ...session.user, role: membership.role },
  };
}

export async function requireAgencySession() {
  const session = await getAgencySession();
  if (!session) redirect("/login");
  return session;
}
