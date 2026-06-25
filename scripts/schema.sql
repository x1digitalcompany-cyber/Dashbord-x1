-- ============================================================
-- Dashboard X1 — Schema SQL completo
-- Execute este arquivo no SQL Editor do seu Supabase
-- ============================================================

-- Extensão UUID
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. USERS  (autenticação própria do dashboard)
-- ────────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid        primary key default gen_random_uuid(),
  email         text        unique not null,
  name          text        not null,
  password_hash text        not null,
  role          text        not null default 'viewer', -- 'admin' | 'viewer'
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 2. SELLERS  (vendedores)
-- ────────────────────────────────────────────────────────────
create table if not exists sellers (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  email      text,
  phone      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 3. ORDERS  (pedidos — Kanban + Agendamentos + Pagamentos)
--    kanban_status é a coluna do Kanban diretamente
-- ────────────────────────────────────────────────────────────
create table if not exists orders (
  id              uuid         primary key default gen_random_uuid(),
  order_number    text         unique not null,
  customer_name   text         not null,
  customer_email  text,
  customer_phone  text,
  customer_cpf    text,
  value           numeric(12,2) not null default 0,
  payment_method  text         not null default 'PIX',      -- PIX | CARD | BOLETO
  gateway         text         not null default 'pagarme',  -- pagarme | payt
  kanban_status   text         not null default 'chegou',   -- chegou | retirar_correios | pagos | devolvidos | inadimplentes
  product_name    text         not null default '',
  seller_id       uuid         references sellers(id) on delete set null,
  tracking_code   text,
  tracking_url    text,
  -- Endereço de entrega
  street          text,
  "number"        text,
  complement      text,
  neighborhood    text,
  city            text,
  state           text,
  zip_code        text,
  -- Timestamps
  paid_at         timestamptz,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 4. LEADS
-- ────────────────────────────────────────────────────────────
create table if not exists leads (
  id         uuid        primary key default gen_random_uuid(),
  name       text,
  email      text,
  phone      text,
  source     text        default 'organico', -- meta | google | organico | indicacao
  status     text        default 'novo',     -- novo | contato | qualificado | convertido | perdido
  seller_id  uuid        references sellers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 5. AD_SPEND  (gastos com anúncios — importação manual ou via sync)
-- ────────────────────────────────────────────────────────────
create table if not exists ad_spend (
  id           uuid         primary key default gen_random_uuid(),
  date         date         not null,
  platform     text         not null default 'meta',  -- meta | google
  account_name text,
  spend        numeric(12,2) not null default 0,
  currency     text         not null default 'BRL',
  created_at   timestamptz  not null default now(),
  unique (date, platform, account_name)
);

-- ────────────────────────────────────────────────────────────
-- 6. AD_ACCOUNTS  (contas Meta/Google para busca via API)
-- ────────────────────────────────────────────────────────────
create table if not exists ad_accounts (
  id           uuid        primary key default gen_random_uuid(),
  account_id   text        not null unique,
  account_name text,
  access_token text        not null,
  currency     text        not null default 'USD',
  platform     text        not null default 'meta',
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index if not exists orders_created_at_idx   on orders (created_at desc);
create index if not exists orders_kanban_status_idx on orders (kanban_status);
create index if not exists orders_gateway_idx       on orders (gateway);
create index if not exists orders_seller_id_idx     on orders (seller_id);
create index if not exists leads_created_at_idx     on leads  (created_at desc);
create index if not exists leads_seller_id_idx      on leads  (seller_id);
create index if not exists ad_spend_date_idx        on ad_spend (date desc);

-- ────────────────────────────────────────────────────────────
-- TRIGGER: updated_at automático
-- ────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

drop trigger if exists users_updated_at on users;
create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS: desabilita para service_role (dashboard usa service key)
-- ────────────────────────────────────────────────────────────
alter table users       disable row level security;
alter table sellers     disable row level security;
alter table orders      disable row level security;
alter table leads       disable row level security;
alter table ad_spend    disable row level security;
alter table ad_accounts disable row level security;

-- ────────────────────────────────────────────────────────────
-- SEED: usuário admin inicial
-- Substitua o hash abaixo pelo resultado de bcrypt.hash('sua_senha', 10)
-- Você pode gerar em: https://bcrypt-generator.com  (rounds = 10)
-- ────────────────────────────────────────────────────────────
-- insert into users (email, name, password_hash, role)
-- values ('admin@dashboard.com', 'Admin', '$2b$10$HASH_AQUI', 'admin')
-- on conflict (email) do nothing;

-- ────────────────────────────────────────────────────────────
-- SEED: dados de exemplo (opcional — remova em produção)
-- ────────────────────────────────────────────────────────────
/*
insert into sellers (name, email) values
  ('Ana Silva',    'ana@empresa.com'),
  ('Bruno Costa',  'bruno@empresa.com'),
  ('Carlos Lima',  'carlos@empresa.com'),
  ('Daniela Melo', 'daniela@empresa.com')
on conflict do nothing;

insert into orders (order_number, customer_name, customer_email, value, payment_method, gateway, kanban_status, product_name)
values
  ('ORD-001', 'João Pereira',    'joao@gmail.com',   1299.90, 'PIX',    'pagarme', 'chegou',          'Produto A'),
  ('ORD-002', 'Maria Santos',   'maria@gmail.com',    649.95, 'CARD',   'payt',    'pagos',            'Produto B'),
  ('ORD-003', 'Pedro Alves',    'pedro@gmail.com',    849.00, 'BOLETO', 'pagarme', 'retirar_correios', 'Produto A'),
  ('ORD-004', 'Lucia Ferreira', 'lucia@gmail.com',   1299.90, 'PIX',    'payt',    'devolvidos',       'Produto C'),
  ('ORD-005', 'Rafael Costa',   'rafael@gmail.com',   499.00, 'CARD',   'pagarme', 'inadimplentes',    'Produto B')
on conflict do nothing;
*/
