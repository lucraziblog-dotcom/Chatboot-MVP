import { ArrowDownLeft, ArrowUpRight, MessageCircle, Plane, Sparkles, UsersRound } from "lucide-react";

import { requireAgencySession } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

const numberFormat = new Intl.NumberFormat("pt-BR");

export default async function DashboardPage() {
  const session = await requireAgencySession();
  const agencyId = session.user.agencyId;
  const [leadCount, activeLeads, conversationCount, waitingCount, recentLeads] = await Promise.all([
    prisma.lead.count({ where: { agencyId } }),
    prisma.lead.count({ where: { agencyId, status: { in: ["NEW", "QUALIFYING", "WAITING_HUMAN", "IN_PROGRESS"] } } }),
    prisma.conversation.count({ where: { agencyId } }),
    prisma.conversation.count({ where: { agencyId, status: "HUMAN" } }),
    prisma.lead.findMany({
      where: { agencyId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, segment: true, status: true, serviceSummary: true, updatedAt: true },
    }),
  ]);

  const metrics = [
    { title: "Leads recebidos", value: numberFormat.format(leadCount), detail: "Oportunidades no seu CRM", icon: UsersRound, color: "mint" },
    { title: "Em atendimento", value: numberFormat.format(activeLeads), detail: "Leads que ainda precisam de atenção", icon: MessageCircle, color: "blue" },
    { title: "Conversas", value: numberFormat.format(conversationCount), detail: "Histórico centralizado", icon: ArrowDownLeft, color: "violet" },
    { title: "Com consultor", value: numberFormat.format(waitingCount), detail: "Aguardando atendimento humano", icon: ArrowUpRight, color: "amber" },
  ];

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Bom dia, {session.user.name?.split(" ")[0] ?? "equipe"} <span className="wave">✦</span></h1>
          <p>Acompanhe as oportunidades e o ritmo dos atendimentos da sua agência.</p>
        </div>
        <a className="button button-primary" href="/leads"><UsersRound size={16} /> Abrir CRM</a>
      </header>

      <section className="metric-grid" aria-label="Indicadores da agência">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.title}>
            <div className={`metric-icon ${metric.color}`}><metric.icon size={19} /></div>
            <p className="metric-label">{metric.title}</p>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-detail">{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel recent-panel">
          <div className="panel-heading">
            <div><h2>Leads recentes</h2><p>As últimas oportunidades cadastradas</p></div>
            <a className="text-link" href="/leads">Ver todos <ArrowUpRight size={15} /></a>
          </div>
          {recentLeads.length ? (
            <div className="recent-list">
              {recentLeads.map((lead) => (
                <a className="recent-row" href="/leads" key={lead.id}>
                  <span className="avatar">{initials(lead.name)}</span>
                  <span className="recent-person"><strong>{lead.name}</strong><small>{lead.serviceSummary || segmentLabel(lead.segment)}</small></span>
                  <span className={`status-pill status-${lead.status.toLowerCase()}`}>{statusLabel(lead.status)}</span>
                  <span className="row-chevron">↗</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <span className="empty-icon"><UsersRound size={23} /></span>
              <strong>Seu próximo destino começa aqui</strong>
              <p>Cadastre o primeiro lead e acompanhe toda a jornada em um só lugar.</p>
              <a className="button button-secondary" href="/leads">Cadastrar primeiro lead</a>
            </div>
          )}
        </article>

        <article className="panel focus-panel">
          <div className="focus-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><span className="focus-plane"><Plane size={28} /></span><span className="focus-spark"><Sparkles size={17} /></span></div>
          <span className="eyebrow">SEU ESPAÇO ESTÁ PRONTO</span>
          <h2>Mais tempo para criar viagens memoráveis.</h2>
          <p>Organize leads de aéreo, excursões e receptivo no CRM da sua agência.</p>
          <a className="text-link" href="/leads">Conhecer o CRM <ArrowUpRight size={15} /></a>
        </article>
      </section>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "Novo",
    QUALIFYING: "Qualificando",
    WAITING_HUMAN: "Com consultor",
    IN_PROGRESS: "Em andamento",
    CONVERTED: "Convertido",
    LOST: "Encerrado",
  };
  return labels[status] ?? status;
}

function segmentLabel(segment: string) {
  const labels: Record<string, string> = {
    AIR: "Aéreo",
    EXCURSION: "Excursão",
    RECEPTIVE: "Receptivo",
    UNDEFINED: "Segmento não informado",
  };
  return labels[segment] ?? segment;
}
