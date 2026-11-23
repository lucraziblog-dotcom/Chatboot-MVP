"use client";

import { Check, Copy, LoaderCircle, MessageCircle, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type SettingsResponse = {
  settings: {
    phoneNumberId: string;
    hasAccessToken: boolean;
    instructions: string;
    handoffMessage: string;
    autoReplyEnabled: boolean;
  };
  readiness: { openAI: boolean; webhook: boolean; encryption: boolean };
  canManage: boolean;
};

type AiTestResult = {
  model: string;
  reply: string;
  segment: string;
};

export function WhatsAppSettings({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<SettingsResponse["settings"]>({
    phoneNumberId: "",
    hasAccessToken: false,
    instructions: "",
    handoffMessage: "Vou encaminhar você para um consultor da nossa equipe.",
    autoReplyEnabled: false,
  });
  const [readiness, setReadiness] = useState<SettingsResponse["readiness"]>({
    openAI: false,
    webhook: false,
    encryption: false,
  });
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AiTestResult | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/whatsapp")
      .then(async (response) => {
        const result = await response.json() as SettingsResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as configurações.");
        if (active) {
          setSettings(result.settings);
          setReadiness(result.readiness);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Falha ao carregar as configurações.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/settings/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, accessToken }),
      });
      const result = await response.json() as { error?: string; saved?: boolean; hasAccessToken?: boolean };
      if (!response.ok || !result.saved) throw new Error(result.error ?? "Não foi possível salvar.");
      setSettings((current) => ({ ...current, hasAccessToken: Boolean(result.hasAccessToken) }));
      setAccessToken("");
      setSuccess("Configurações salvas. O token não será exibido novamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function testAi() {
    setTestingAi(true);
    setError("");
    setAiTestResult(null);
    try {
      const response = await fetch("/api/settings/whatsapp/test-ai", { method: "POST" });
      const result = await response.json() as AiTestResult & { error?: string };
      if (!response.ok || !result.reply) {
        throw new Error(result.error ?? "Não foi possível testar a IA.");
      }
      setAiTestResult(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível testar a IA.");
    } finally {
      setTestingAi(false);
    }
  }

  if (loading) {
    return <div className="panel settings-loading"><LoaderCircle className="spin" size={18} /> Carregando configurações...</div>;
  }

  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2><MessageCircle size={18} /> WhatsApp Cloud API</h2>
            <p>Use primeiro o número de teste fornecido pela Meta.</p>
          </div>
          <span className={`settings-badge ${settings.hasAccessToken && settings.phoneNumberId ? "is-ready" : ""}`}>
            {settings.hasAccessToken && settings.phoneNumberId ? "Conectado" : "Não conectado"}
          </span>
        </div>

        <div className="webhook-box">
          <div><strong>URL do webhook</strong><small>Cadastre esta URL no painel do app Meta.</small></div>
          <div className="webhook-copy">
            <code>{typeof window === "undefined" ? "" : `${window.location.origin}/api/whatsapp/webhook`}</code>
            <button type="button" className="button button-quiet" onClick={copyWebhookUrl} aria-label="Copiar URL do webhook">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {!canManage ? (
          <p className="settings-note">Somente proprietários e administradores podem alterar estas configurações.</p>
        ) : (
          <form className="settings-form" onSubmit={saveSettings}>
            <label className="field">
              ID do número de telefone
              <input
                inputMode="numeric"
                autoComplete="off"
                value={settings.phoneNumberId}
                onChange={(event) => setSettings({ ...settings, phoneNumberId: event.target.value })}
                placeholder="Ex.: 123456789012345"
                required
              />
              <small>É o Phone Number ID exibido no painel WhatsApp da Meta, não o número com DDD.</small>
            </label>

            <label className="field">
              Token de acesso da Meta
              <input
                type="password"
                autoComplete="new-password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder={settings.hasAccessToken ? "Token salvo; deixe vazio para manter" : "Cole o token de acesso"}
                required={!settings.hasAccessToken}
              />
              <small>O token é criptografado antes de ser guardado e nunca é devolvido pela API.</small>
            </label>

            <label className="field">
              Instruções da agência para a IA
              <textarea
                value={settings.instructions}
                onChange={(event) => setSettings({ ...settings, instructions: event.target.value })}
                placeholder="Ex.: atendemos famílias e priorizamos passeios acessíveis."
                rows={3}
                maxLength={2000}
              />
            </label>

            <label className="field">
              Mensagem ao transferir para uma pessoa
              <input
                value={settings.handoffMessage}
                onChange={(event) => setSettings({ ...settings, handoffMessage: event.target.value })}
                maxLength={500}
                required
              />
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.autoReplyEnabled}
                onChange={(event) => setSettings({ ...settings, autoReplyEnabled: event.target.checked })}
              />
              <span><strong>Ativar respostas automáticas</strong><small>Desativado por padrão. Ative somente depois de configurar as chaves e testar o webhook.</small></span>
            </label>

            <div className="settings-readiness" aria-label="Pré-requisitos de integração">
              <ReadinessItem ready={readiness.openAI} label="Provedor de IA configurado" />
              <ReadinessItem ready={readiness.webhook} label="Webhook da Meta configurado" />
              <ReadinessItem ready={readiness.encryption} label="Criptografia pronta" />
            </div>

            <div className="settings-ai-test">
              <button
                className="button button-secondary"
                type="button"
                onClick={testAi}
                disabled={!readiness.openAI || testingAi}
              >
                {testingAi ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {testingAi ? "Testando..." : "Testar IA sem enviar WhatsApp"}
              </button>
              {aiTestResult && (
                <div className="settings-test-result" role="status">
                  <strong>Resposta de teste ({aiTestResult.model})</strong>
                  <p>{aiTestResult.reply}</p>
                  <small>Segmento detectado: {aiTestResult.segment}</small>
                </div>
              )}
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="settings-success" role="status">{success}</p>}
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              Salvar configuração
            </button>
          </form>
        )}
      </section>

      <aside className="panel settings-help">
        <span className="settings-help-icon"><ShieldCheck size={19} /></span>
        <h2>Checklist para o primeiro teste</h2>
        <ol>
          <li>Crie um app na Meta Developers e adicione o produto WhatsApp.</li>
          <li>Use o número de teste e autorize seu WhatsApp pessoal como destinatário de teste.</li>
          <li>Configure as variáveis secretas da OpenAI e da Meta no projeto Vercel.</li>
          <li>Cadastre a URL do webhook, o token de verificação e assine o campo <code>messages</code>.</li>
          <li>Salve o Phone Number ID e o token; depois ative as respostas automáticas.</li>
        </ol>
        <p>O token de acesso da Meta é armazenado criptografado. Não o envie pelo chat nem o inclua em capturas de tela.</p>
      </aside>
    </div>
  );
}

function ReadinessItem({ ready, label }: { ready: boolean; label: string }) {
  return <span className={ready ? "readiness-ready" : "readiness-pending"}>{ready ? "✓" : "•"} {label}</span>;
}
