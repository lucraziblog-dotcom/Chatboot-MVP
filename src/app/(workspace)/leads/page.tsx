import { requireAgencySession } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";
import { LeadsManager } from "@/components/leads/leads-manager";

export default async function LeadsPage() {
  const session = await requireAgencySession();
  const rows = await prisma.lead.findMany({
    where: { agencyId: session.user.agencyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 31,
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
  const hasMore = rows.length > 30;
  const leads = hasMore ? rows.slice(0, 30) : rows;

  return (
    <LeadsManager
      initialLeads={leads.map((lead) => ({ ...lead, updatedAt: lead.updatedAt.toISOString() }))}
      initialHasMore={hasMore}
      initialCursor={hasMore ? leads[leads.length - 1]?.id ?? null : null}
    />
  );
}
