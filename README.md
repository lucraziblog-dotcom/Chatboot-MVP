# Turismo AI

MVP próprio de SaaS multiempresa para pré-atendimento e qualificação de leads de agências de turismo. O código é desenvolvido neste repositório; o WhatsApp AI Receptionist foi consultado somente como referência de arquitetura, sem copiar seus arquivos.

## Decisões da primeira etapa

- Next.js App Router, TypeScript e Tailwind CSS.
- PostgreSQL com Prisma; agência e associação de usuários são entidades explícitas para permitir equipes e crescimento além de uma conta por agência.
- Login com credenciais, senha com hash bcrypt e sessão JWT via Auth.js/NextAuth.
- Leads, conversas e mensagens pertencem a uma agência. APIs obtêm o tenant da sessão, nunca de um ID enviado pelo navegador.
- A primeira entrega cobre cadastro, login, dashboard e CRM. Ainda não envia mensagens nem usa respostas simuladas como se fossem integração real.
- Segmentos turísticos e qualificação ficam estruturados no modelo desde o início; IA, WhatsApp, assinatura de webhook e idempotência serão módulos posteriores.

## Estrutura

```text
prisma/                 modelo multi-tenant e futuras migrações
src/app/(auth)/         cadastro e login
src/app/(workspace)/    dashboard e CRM protegidos
src/app/api/            autenticação e operações do CRM
src/components/         layout e interface
src/lib/auth/           autenticação e escopo do tenant
src/lib/db.ts           cliente Prisma com pool PostgreSQL limitado
src/generated/prisma/   cliente gerado (não versionado)
```

## Rodar localmente

Requisitos: Node.js 20.19+, PostgreSQL e npm.

1. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `DIRECT_DATABASE_URL` e `NEXTAUTH_SECRET` (substitua o valor de exemplo por um segredo aleatório forte).
2. Instale dependências com `npm install`.
3. Gere o cliente e aplique o esquema: `npm run db:push`.
4. Inicie: `npm run dev`.

O cadastro cria uma agência e seu primeiro usuário administrador em uma transação. As credenciais de WhatsApp e OpenAI ainda não são necessárias nesta etapa. O cliente Prisma usa o adaptador oficial para PostgreSQL e limites de conexão iniciais explícitos.

`db:push` é para desenvolvimento local. Antes de produção, gere e revise migrações com `npm run db:migrate` e aplique-as no deploy com `npm run db:migrate:deploy`.

## Publicação recomendada para o MVP

Como o projeto já está sendo criado na Vercel, **Prisma Postgres** é a opção mais simples para o primeiro deploy: a integração cria o banco e configura `DATABASE_URL` (conexão direta, usada pelas migrações) e `DATABASE_URL_POOLED` (pool, usado pela aplicação). O cliente em `src/lib/db.ts` prioriza a URL pooled. Escolha São Paulo, se disponível.

Como alternativa, mantenha o Neon já criado: configure `DATABASE_URL` com a URL pooled e `DIRECT_DATABASE_URL` com a URL direta. Não misture provedores; ao trocar de Neon para Prisma Postgres, remova `DIRECT_DATABASE_URL` do Neon.

A oferta Prisma Postgres exibida na Vercel mostra 2 GB e 100 mil operações/mês, contra 1 GB no plano gratuito Neon consultado. Isso dá mais espaço, mas os limites não são diretamente comparáveis: a página pública do Prisma lista 200 mil operações no Free. Confirme o limite efetivo no painel antes de escolher. Uma operação equivale a uma consulta ao banco; monitore o consumo conforme crescer o número de leads e conversas.

1. Instale a integração Prisma Postgres no projeto Vercel, ou decida manter o Neon — não configure ambos como bancos diferentes para a mesma aplicação.
2. Configure `NEXTAUTH_URL` com o domínio público e `NEXTAUTH_SECRET` com um segredo exclusivo. Mantenha essas variáveis fora do Git e não as envie pelo chat.
3. Antes do primeiro uso, aplique a migração inicial com `npm run db:migrate:deploy`, usando as variáveis do banco direto escolhido.

Uma opção de segredo pode ser gerada localmente com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

Como outra alternativa, a aplicação e o PostgreSQL podem ficar no Render; isso facilita adicionar um worker separado quando o processamento de mensagens exigir filas. Para WhatsApp/IA em produção, planeje processamento assíncrono, limites de conexão e rate limiting distribuído. Ainda não há deploy configurado: publicação exige URLs e segredos fornecidos pelo responsável.

O cadastro público ainda não tem verificação de e-mail nem proteção distribuída contra abuso; adicione esses controles antes de divulgar o endpoint de criação de contas. Também valide requisitos de LGPD, retenção e recuperação de senha antes de aceitar dados reais.

## Próximas etapas

1. Validar o esquema, autenticação e isolamento do CRM com PostgreSQL local.
2. Adicionar configurações da agência, serviços, FAQs, horários e detalhes de aéreo, excursões e receptivo.
3. Integrar o agente de IA com respostas fundamentadas nos dados aprovados da agência e opção de atendimento humano.
4. Integrar a WhatsApp Cloud API com assinatura obrigatória, segredos protegidos, processamento idempotente e observabilidade.

O isolamento no banco e a capacidade para 100 agências precisam ser exercitados com testes de integração e carga antes de qualquer promessa de produção. Webhooks, limites distribuídos, retenção/LGPD e controles de acesso serão validados nas respectivas etapas.
