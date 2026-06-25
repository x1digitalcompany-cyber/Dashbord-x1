# Dashboard X1

Painel operacional e financeiro que centraliza métricas de marketing, vendas, pagamentos e logística da operação Five em uma única interface.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** + componentes UI customizados
- **Supabase** (PostgreSQL) — banco próprio do dashboard
- **NextAuth** — autenticação
- **Recharts** — gráficos
- **Meta Graph API** — gasto com anúncios

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores:

```bash
cp .env.example .env.local
```

| Variável | Descrição |
|----------|-----------|
| `DASHBOARD_SUPABASE_URL` | URL do projeto Supabase |
| `DASHBOARD_SUPABASE_SERVICE_ROLE_KEY` | Service role key (servidor apenas) |
| `NEXTAUTH_SECRET` | Segredo para sessões |
| `NEXTAUTH_URL` | URL do app (ex: `http://localhost:3001`) |
| `FIVE_WEBHOOK_SECRET_ANTECIPADO` | Secret do webhook Five Antecipada |
| `FIVE_WEBHOOK_SECRET_AGENDADO` | Secret do webhook Five Agendada |

Meta Ads pode ser configurado em **Configurações → Meta Ads** (tabela `ad_accounts`).

## Como rodar localmente

```bash
npm install
cp .env.example .env.local
# Preencha .env.local
npm run dev
```

Acesse [http://localhost:3001](http://localhost:3001)

Execute as migrations em `supabase/migrations/` no SQL Editor do Supabase.

## Webhooks Five

Duas operações, dois endpoints:

| Operação | URL | Header |
|----------|-----|--------|
| **Antecipada** | `POST /api/webhooks/five/antecipado` | `X-Five-Secret: FIVE_WEBHOOK_SECRET_ANTECIPADO` |
| **Agendada** | `POST /api/webhooks/five/agendado` | `X-Five-Secret: FIVE_WEBHOOK_SECRET_AGENDADO` |

Legado (sem secret): `POST /api/webhooks/five`

Configure as URLs e secrets na plataforma Five e em **Configurações → Webhooks** no dashboard.

## Módulos

- Dashboard financeiro (KPIs, gráficos, mapas por UF)
- Kanban Five com abas **Antecipado** e **Agendado**
- Agendamentos, Pagamentos, Configurações (Meta Ads + Webhooks)

## Scripts

```bash
npm run dev    # desenvolvimento
npm run build  # build de produção
npm run start  # servidor de produção
```
