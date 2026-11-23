# Turismo AI

MVP próprio de SaaS multiempresa para pré-atendimento e qualificação de leads de agências de turismo. O código é desenvolvido neste repositório; o WhatsApp AI Receptionist foi consultado somente como referência de arquitetura, sem copiar seus arquivos.

## Decisões da primeira etapa

- Next.js App Router, TypeScript e Tailwind CSS.
- PostgreSQL com Prisma; agência e associação de usuários são entidades explícitas para permitir equipes e crescimento além de uma conta por agência.
- Login com credenciais, senha com hash bcrypt e sessão JWT via Auth.js/NextAuth.
- Leads, conversas e mensagens pertencem a uma agência. APIs obtêm o tenant da sessão, nunca de um ID enviado pelo navegador.
- A base já cobre cadastro, login, dashboard e CRM; a primeira integração piloto usa a WhatsApp Cloud API e a OpenAI para mensagens de texto.
- Cada número do WhatsApp é associado a uma agência, os tokens de acesso ficam criptografados e o tenant vem da configuração persistida no servidor, nunca do payload recebido.
- A assinatura do webhook é obrigatória, mensagens recebidas são deduplicadas pelo ID da Meta e respostas automáticas ficam desativadas até a agência habilitá-las.

## Estrutura

```text
prisma/                 modelo multi-tenant e futuras migrações
src/app/(auth)/         cadastro e login
src/app/(workspace)/    dashboard e CRM protegidos
src/app/api/            autenticação, CRM, configurações e webhook do WhatsApp
src/components/         layout e interface
src/lib/auth/           autenticação e escopo do tenant
src/lib/whatsapp/       assinatura, credenciais e envio pela Cloud API
src/lib/ai/             qualificação inicial com OpenAI
src/lib/db.ts           cliente Prisma com pool PostgreSQL limitado
src/generated/prisma/   cliente gerado (não versionado)
```

## Rodar localmente

Requisitos: Node.js 20.19+, PostgreSQL e npm.

1. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `DIRECT_DATABASE_URL` e `NEXTAUTH_SECRET` (substitua o valor de exemplo por um segredo aleatório forte). Para testar as integrações localmente, configure também as variáveis da seção abaixo.
2. Instale dependências com `npm install`.
3. Gere o cliente e aplique o esquema: `npm run db:push`.
4. Inicie: `npm run dev`.

O cadastro cria uma agência e seu primeiro usuário administrador em uma transação. O cliente Prisma usa o adaptador oficial para PostgreSQL e limites de conexão iniciais explícitos.

`db:push` é para desenvolvimento local. Antes de produção, gere e revise migrações com `npm run db:migrate` e aplique-as no deploy com `npm run db:migrate:deploy`.

## Publicação recomendada para o MVP

Como o projeto já está sendo criado na Vercel, **Prisma Postgres** é a opção mais simples para o primeiro deploy: a integração cria o banco e configura `DATABASE_URL` (conexão direta, usada pelas migrações) e `DATABASE_URL_POOLED` (pool, usado pela aplicação). O cliente em `src/lib/db.ts` prioriza a URL pooled. Escolha São Paulo, se disponível.

Como alternativa, mantenha o Neon já criado: configure `DATABASE_URL` com a URL pooled e `DIRECT_DATABASE_URL` com a URL direta. Não misture provedores; ao trocar de Neon para Prisma Postgres, remova `DIRECT_DATABASE_URL` do Neon.

A oferta Prisma Postgres exibida na Vercel mostra 2 GB e 100 mil operações/mês, contra 1 GB no plano gratuito Neon consultado. Isso dá mais espaço, mas os limites não são diretamente comparáveis: a página pública do Prisma lista 200 mil operações no Free. Confirme o limite efetivo no painel antes de escolher. Uma operação equivale a uma consulta ao banco; monitore o consumo conforme crescer o número de leads e conversas.

1. Instale a integração Prisma Postgres no projeto Vercel, ou decida manter o Neon — não configure ambos como bancos diferentes para a mesma aplicação.
2. Configure `NEXTAUTH_URL` com o domínio público e `NEXTAUTH_SECRET` com um segredo exclusivo. Mantenha essas variáveis fora do Git e não as envie pelo chat.
3. Antes do primeiro uso, aplique a migração inicial com `npm run db:migrate:deploy`, usando as variáveis do banco direto escolhido.

Uma opção de segredo pode ser gerada localmente com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

Como outra alternativa, a aplicação e o PostgreSQL podem ficar no Render; isso facilita adicionar um worker separado quando o processamento de mensagens exigir filas. O app já está publicado na Vercel; conectar Meta e OpenAI ainda exige configurar as chaves do responsável.

O cadastro público ainda não tem verificação de e-mail nem proteção distribuída contra abuso; adicione esses controles antes de divulgar o endpoint de criação de contas. Também valide requisitos de LGPD, retenção e recuperação de senha antes de aceitar dados reais.

## Primeiro teste com WhatsApp Cloud API

O piloto usa a API oficial da Meta e aceita mensagens de texto. Não conecte um número pessoal como se fosse uma credencial: comece com o número de teste e um destinatário de teste autorizado no painel Meta.

1. No projeto Vercel, configure em **Settings → Environment Variables**:
   - `OPENAI_API_KEY`: chave do provedor OpenAI-compatible.
   - `OPENAI_BASE_URL`: endpoint-base HTTPS; para OpenAI, `https://api.openai.com/v1`.
   - `OPENAI_MODEL`: modelo aceito pelo provedor (o padrão é `gpt-4o-mini`).
   - `WHATSAPP_APP_SECRET`: App Secret do app Meta.
   - `WHATSAPP_VERIFY_TOKEN`: valor aleatório criado por você; use o mesmo na configuração do webhook da Meta.
   - `WHATSAPP_TOKEN_ENCRYPTION_KEY`: chave de 32 bytes em Base64, gerada com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   - `WHATSAPP_GRAPH_API_VERSION`: versão Graph atualmente suportada pela Meta (o exemplo usa `v24.0`).
2. Salve as variáveis e faça novo deploy. Mantenha `WHATSAPP_TOKEN_ENCRYPTION_KEY` estável: trocar essa chave sem recriptografar tokens desconectará os números já salvos.
3. Entre no dashboard, abra **WhatsApp e IA**, informe o Phone Number ID e o token de acesso de teste da Meta e salve. O token não será exibido novamente.
4. No app Meta, configure o callback `https://chatboot-mvp.vercel.app/api/whatsapp/webhook`, informe o mesmo `WHATSAPP_VERIFY_TOKEN` e assine o campo `messages`.
5. Autorize seu WhatsApp como destinatário de teste, envie uma mensagem para o número de teste e só então habilite as respostas automáticas. Tokens temporários da Meta podem expirar; para uso contínuo, crie um token apropriado no Business Manager.

Para usar a API compatível da Gemini, defina `OPENAI_BASE_URL` como `https://generativelanguage.googleapis.com/v1beta/openai` e `OPENAI_MODEL` para um modelo habilitado na sua conta. A cota gratuita varia por modelo e projeto; confira os limites atuais no Google AI Studio. O endpoint local da FreeLLMAPI (`127.0.0.1`) não é acessível pela Vercel.

As variáveis do app Meta e do provedor de IA ficam no servidor; o token da agência é criptografado antes de ir ao banco. O webhook rejeita assinaturas inválidas, deduplica IDs da Meta e permite reprocessar mensagens que falharam. O processamento ainda é síncrono e limitado a texto; antes de aumentar tráfego ou atender dezenas de agências, adicione fila/outbox, métricas e testes de carga. As mensagens enviadas ao provedor de IA são dados pessoais processados por terceiro; valide consentimento, retenção e LGPD antes de usar conversas reais.

## Próximas etapas

1. Validar o esquema, autenticação e isolamento do CRM com PostgreSQL local.
2. Adicionar gestão de conversas, serviços, FAQs, horários e detalhes de aéreo, excursões e receptivo.
3. Expandir a qualificação da IA e a transferência para consultores com fila e atualização em tempo real.
4. Adicionar onboarding oficial de números por agência, observabilidade, retentativas e testes de carga.

O isolamento no banco e a capacidade para 100 agências precisam ser exercitados com testes de integração e carga antes de qualquer promessa de produção. Webhooks, limites distribuídos, retenção/LGPD e controles de acesso serão validados nas respectivas etapas.
