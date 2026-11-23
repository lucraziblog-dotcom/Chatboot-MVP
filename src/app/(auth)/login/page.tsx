import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="auth-card">
      <span className="eyebrow">BEM-VINDO DE VOLTA</span>
      <h2>Entre na sua conta</h2>
      <p className="auth-description">Acesse o espaço da sua agência para continuar os atendimentos.</p>
      <LoginForm />
      <p className="auth-switch">Ainda não tem uma conta? <a href="/cadastro">Criar conta</a></p>
    </div>
  );
}
