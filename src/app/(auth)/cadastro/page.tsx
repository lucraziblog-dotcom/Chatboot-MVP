import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="auth-card">
      <span className="eyebrow">COMECE SUA JORNADA</span>
      <h2>Crie sua agência</h2>
      <p className="auth-description">Seu espaço de atendimento começa com alguns dados.</p>
      <RegisterForm />
      <p className="auth-switch">Já tem uma conta? <a href="/login">Entrar</a></p>
    </div>
  );
}
