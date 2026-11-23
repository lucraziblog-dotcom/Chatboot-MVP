"use client";

import type { LeadStatus, TourismSegment } from "@/generated/prisma/client";
import { useEffect, useRef, useState } from "react";
import { Search, Plus, UsersRound, LoaderCircle, Plane, MapPinned, Compass } from "lucide-react";

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  segment: TourismSegment;
  status: LeadStatus;
  serviceSummary: string | null;
  updatedAt: string;
};

const statusNames: Record<LeadStatus, string> = {
  NEW: "Novo",
  QUALIFYING: "Qualificando",
  WAITING_HUMAN: "Com consultor",
  IN_PROGRESS: "Em andamento",
  CONVERTED: "Convertido",
  LOST: "Encerrado",
};

const segmentNames: Record<TourismSegment, string> = {
  AIR: "Aéreo",
  EXCURSION: "Excursão",
  RECEPTIVE: "Receptivo",
  UNDEFINED: "Não definido",
};

const segmentIcons: Record<TourismSegment, typeof Plane> = {
  AIR: Plane,
  EXCURSION: MapPinned,
  RECEPTIVE: Compass,
  UNDEFINED: Compass,
};

async function requestLeads(filters: { q?: string; segment?: string; status?: string; cursor?: string }) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) searchParams.set(key, value);
  }
  const response = await fetch(`/api/leads?${searchParams.toString()}`);
  const result = (await response.json()) as {
    leads?: LeadRow[];
    hasMore?: boolean;
    nextCursor?: string | null;
    error?: string;
  };
  if (!response.ok || !result.leads || typeof result.hasMore !== "boolean") {
    throw new Error(result.error ?? "Não foi possível carregar os leads.");
  }
  return result as { leads: LeadRow[]; hasMore: boolean; nextCursor: string | null };
}

export function LeadsManager({
  initialLeads,
  initialHasMore,
  initialCursor,
}: {
  initialLeads: LeadRow[];
  initialHasMore: boolean;
  initialCursor: string | null;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState("");
  const firstFilterEffect = useRef(true);

  useEffect(() => {
    if (firstFilterEffect.current) {
      firstFilterEffect.current = false;
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const page = await requestLeads({
          q: search.trim(),
          segment: segmentFilter === "ALL" ? undefined : segmentFilter,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        });
        if (cancelled) return;
        setLeads(page.leads);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os leads.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, segmentFilter, statusFilter]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await requestLeads({
        q: search.trim(),
        segment: segmentFilter === "ALL" ? undefined : segmentFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        cursor: nextCursor,
      });
      setLeads((current) => [...current, ...page.leads]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar mais leads.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          segment: formData.get("segment"),
          serviceSummary: formData.get("serviceSummary"),
        }),
      });
      const result = (await response.json()) as { lead?: LeadRow; error?: string };
      if (!response.ok || !result.lead) {
        setError(result.error ?? "Não foi possível salvar o lead.");
        return;
      }
      setLeads((current) => [result.lead!, ...current]);
      setShowForm(false);
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(leadId: string, status: LeadStatus) {
    setUpdating(leadId);
    setError("");
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Não foi possível atualizar o status.");
        return;
      }
      setLeads((current) => current
        .map((lead) => lead.id === leadId ? { ...lead, status } : lead)
        .filter((lead) => statusFilter === "ALL" || lead.status === statusFilter));
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setUpdating("");
    }
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div><span className="eyebrow">RELACIONAMENTO</span><h1>Leads e CRM</h1><p>Cuide de cada oportunidade, da primeira conversa à próxima viagem.</p></div>
        <button className="button button-primary" onClick={() => { setShowForm((value) => !value); setError(""); }} type="button"><Plus size={17} /> Novo lead</button>
      </header>

      {showForm && (
        <form className="panel create-lead-form" onSubmit={createLead}>
          <div className="panel-heading"><div><h2>Novo lead</h2><p>Cadastre uma oportunidade para sua equipe acompanhar.</p></div><button className="button button-quiet" onClick={() => setShowForm(false)} type="button">Cancelar</button></div>
          <div className="form-grid">
            <label className="field"><span>Nome</span><input name="name" placeholder="Nome do viajante" minLength={2} maxLength={120} required /></label>
            <label className="field"><span>WhatsApp / telefone</span><input name="phone" placeholder="+55 (11) 99999-9999" minLength={8} maxLength={30} required /></label>
            <label className="field"><span>E-mail <small>(opcional)</small></span><input name="email" type="email" placeholder="viajante@email.com" /></label>
            <label className="field"><span>Segmento</span><select name="segment" defaultValue="UNDEFINED"><option value="UNDEFINED">Escolha um segmento</option><option value="AIR">Aéreo</option><option value="EXCURSION">Excursão</option><option value="RECEPTIVE">Receptivo</option></select></label>
            <label className="field field-span"><span>O que procura? <small>(opcional)</small></span><input name="serviceSummary" placeholder="Ex.: passagem para Recife em julho" maxLength={500} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Salvar lead</button></div>
        </form>
      )}

      <section className="panel crm-panel">
        <div className="crm-toolbar">
          <div className="crm-title"><div className="crm-title-icon"><UsersRound size={18} /></div><div><h2>Todos os leads</h2><p>{loading ? "Atualizando resultados..." : `${leads.length} ${leads.length === 1 ? "oportunidade" : "oportunidades"} nesta página`}</p></div></div>
          <div className="crm-filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lead..." aria-label="Buscar lead" /></label>
            <select value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)} aria-label="Filtrar por segmento"><option value="ALL">Todos segmentos</option><option value="AIR">Aéreo</option><option value="EXCURSION">Excursão</option><option value="RECEPTIVE">Receptivo</option><option value="UNDEFINED">Não definido</option></select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status"><option value="ALL">Todos status</option>{Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
          </div>
        </div>
        {error && !showForm && <p className="form-error inline-error" role="alert">{error}</p>}
        {leads.length ? (
          <div className="table-scroll"><table className="leads-table">
            <thead><tr><th>VIAJANTE</th><th>INTERESSE</th><th>CONTATO</th><th>STATUS</th></tr></thead>
            <tbody>{leads.map((lead) => {
              const SegmentIcon = segmentIcons[lead.segment];
              return <tr key={lead.id}>
                <td><div className="table-person"><span className={`segment-avatar ${lead.segment.toLowerCase()}`}><SegmentIcon size={16} /></span><span><strong>{lead.name}</strong><small>Atualizado em {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(lead.updatedAt))}</small></span></div></td>
                <td><span className="segment-name">{segmentNames[lead.segment]}</span><small className="table-subtext">{lead.serviceSummary || "Interesse ainda não detalhado"}</small></td>
                <td><span className="contact-text">{lead.phone}</span><small className="table-subtext">{lead.email || "—"}</small></td>
                <td><div className="status-select-wrap">{updating === lead.id && <LoaderCircle className="spin status-loader" size={14} />}<select className={`status-select status-${lead.status.toLowerCase()}`} value={lead.status} onChange={(event) => changeStatus(lead.id, event.target.value as LeadStatus)} aria-label={`Status de ${lead.name}`}>{Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></div></td>
              </tr>;
            })}</tbody>
          </table></div>
        ) : (
          <div className="empty-crm"><span className="empty-icon"><UsersRound size={23} /></span><strong>{search || segmentFilter !== "ALL" || statusFilter !== "ALL" ? "Nenhum lead encontrado" : "Sua lista começa com uma conversa"}</strong><p>{search || segmentFilter !== "ALL" || statusFilter !== "ALL" ? "Tente mudar os filtros ou o termo buscado." : "Cadastre sua primeira oportunidade para organizar o atendimento da agência."}</p>{!search && segmentFilter === "ALL" && statusFilter === "ALL" && <button className="button button-secondary" onClick={() => setShowForm(true)} type="button"><Plus size={16} /> Cadastrar primeiro lead</button>}</div>
        )}
        {hasMore && <div className="pagination"><button className="button button-secondary" disabled={loadingMore} onClick={loadMore} type="button">{loadingMore ? <LoaderCircle className="spin" size={15} /> : null} Carregar mais leads</button></div>}
      </section>
      <p className="crm-note">Os dados desta lista são privados e visíveis apenas para os usuários da sua agência.</p>
    </div>
  );
}
