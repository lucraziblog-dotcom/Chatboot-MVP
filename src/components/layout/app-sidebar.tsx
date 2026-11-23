"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Compass, LayoutDashboard, MessageCircle, Plane, Settings2, UsersRound, LogOut, ChevronDown, Sparkles } from "lucide-react";

const mainLinks = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/leads", label: "Leads e CRM", icon: UsersRound },
];

const futureLinks = [
  { label: "Conversas", icon: MessageCircle },
  { label: "Serviços turísticos", icon: Plane },
  { label: "Configurações da IA", icon: Sparkles },
];

export function AppSidebar({ agencyName, userName, role }: { agencyName: string; userName: string; role: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand sidebar-brand">
        <span className="brand-mark"><Compass size={21} strokeWidth={2.2} /></span>
        <span>turismo<span className="brand-accent">.ai</span></span>
      </Link>

      <button className="agency-switcher" type="button" aria-label={`Agência ${agencyName}`}>
        <span className="agency-avatar">{agencyName.trim().charAt(0).toUpperCase()}</span>
        <span className="agency-info"><strong>{agencyName}</strong><small>Espaço da agência</small></span>
        <ChevronDown size={16} />
      </button>

      <div className="nav-section-label">MENU PRINCIPAL</div>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {mainLinks.map((item) => {
          const active = pathname === item.href || (item.href === "/leads" && pathname.startsWith("/leads"));
          return <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}><item.icon size={18} /><span>{item.label}</span>{item.href === "/leads" && <span className="nav-dot" />}</Link>;
        })}
      </nav>

      <div className="nav-section-label nav-section-spaced">ATENDIMENTO</div>
      <nav className="sidebar-nav" aria-label="Módulos de atendimento">
        {futureLinks.map((item) => <span key={item.label} className="nav-link nav-disabled" title="Disponível em uma próxima etapa"><item.icon size={18} /><span>{item.label}</span><small>em breve</small></span>)}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span><Sparkles size={15} /></span><strong>Feito para turismo</strong><p>Um atendimento mais organizado para cada tipo de viagem.</p></div>
        <Link href="/dashboard" className="nav-link nav-settings"><Settings2 size={18} /><span>Preferências</span></Link>
        <div className="user-card">
          <span className="user-avatar">{userName.trim().charAt(0).toUpperCase()}</span>
          <span className="user-info"><strong>{userName}</strong><small>{role === "OWNER" ? "Proprietário" : role === "ADMIN" ? "Administrador" : "Consultor"}</small></span>
          <button className="logout-button" onClick={() => signOut({ callbackUrl: "/login" })} type="button" aria-label="Sair"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  );
}
