import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireAgencySession } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAgencySession();
  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: { name: true },
  });
  if (!agency) {
    return <main className="workspace-error">Não foi possível carregar o espaço da agência. Entre novamente ou contate o suporte.</main>;
  }

  return (
    <div className="workspace">
      <AppSidebar agencyName={agency.name} userName={session.user.name ?? session.user.email ?? "Equipe"} role={session.user.role} />
      <main className="workspace-main">{children}</main>
    </div>
  );
}
