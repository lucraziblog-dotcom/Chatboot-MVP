import { WhatsAppSettings } from "@/components/settings/whatsapp-settings";
import { requireAgencySession } from "@/lib/auth/tenant";

export default async function SettingsPage() {
  const session = await requireAgencySession();
  const canManage = session.user.role === "OWNER" || session.user.role === "ADMIN";

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow">INTEGRAÇÕES</span>
          <h1>WhatsApp e atendimento IA</h1>
          <p>Conecte um número de teste da Meta e configure as respostas da sua agência.</p>
        </div>
      </header>
      <WhatsAppSettings canManage={canManage} />
    </div>
  );
}
