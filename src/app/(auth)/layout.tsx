import Link from "next/link";
import { Compass, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="brand brand-light" href="/">
          <span className="brand-mark"><Compass size={21} strokeWidth={2.2} /></span>
          <span>turismo<span className="brand-accent">.ai</span></span>
        </Link>
        <div className="story-content">
          <span className="eyebrow eyebrow-light"><Sparkles size={14} /> PRÉ-ATENDIMENTO PARA TURISMO</span>
          <h1>Mais conversas que viram <span>viagens.</span></h1>
          <p>Organize cada oportunidade, entenda o que o viajante procura e deixe seu time cuidar do que importa: realizar planos.</p>
          <div className="story-points">
            <div><MessageCircle size={17} /><span>Atendimento próximo, do primeiro oi ao consultor</span></div>
            <div><ShieldCheck size={17} /><span>Um espaço seguro para cada agência e sua equipe</span></div>
          </div>
        </div>
        <p className="story-footer">Feito para quem transforma destinos em histórias.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-brand">
          <Link className="brand" href="/">
            <span className="brand-mark"><Compass size={20} /></span>
            <span>turismo<span className="brand-accent">.ai</span></span>
          </Link>
        </div>
        {children}
        <p className="auth-legal">Ao continuar, você concorda com nossos termos de uso e política de privacidade.</p>
      </section>
    </main>
  );
}
