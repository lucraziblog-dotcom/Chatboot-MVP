"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          agencyName: formData.get("agencyName"),
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível criar a conta.");
        return;
      }

      const login = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (login?.error) {
        setError("Conta criada, mas não foi possível entrar automaticamente. Faça login.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Seu nome</span>
        <input name="name" placeholder="Como podemos te chamar?" autoComplete="name" minLength={2} maxLength={100} required />
      </label>
      <label className="field">
        <span>Nome da agência</span>
        <input name="agencyName" placeholder="Ex.: Rota dos Sonhos" minLength={2} maxLength={120} required />
      </label>
      <label className="field">
        <span>E-mail profissional</span>
        <input name="email" type="email" placeholder="voce@suaagencia.com.br" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Senha <small>(mínimo 10 caracteres)</small></span>
        <input name="password" type="password" placeholder="Crie uma senha segura" autoComplete="new-password" minLength={10} maxLength={72} required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="spin" size={17} /> : <>Criar meu espaço <ArrowRight size={17} /></>}
      </button>
    </form>
  );
}
