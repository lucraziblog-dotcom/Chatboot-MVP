"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (result?.error) {
        setError("E-mail ou senha inválidos.");
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
        <span>E-mail</span>
        <input name="email" type="email" placeholder="voce@suaagencia.com.br" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Senha</span>
        <input name="password" type="password" placeholder="Sua senha" autoComplete="current-password" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="spin" size={17} /> : <>Entrar na plataforma <ArrowRight size={17} /></>}
      </button>
    </form>
  );
}
