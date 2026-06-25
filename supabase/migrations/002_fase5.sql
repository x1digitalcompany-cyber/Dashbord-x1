-- Dashboard X1 — Fase 5: métricas financeiras, mapas por estado, cache Meta Ads
-- Execute no SQL Editor do Supabase (projeto ermgwbddptubznbsbrii)

-- Colunas extras em orders (Five webhook)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estado VARCHAR(2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20);

-- Backfill estado a partir de state existente
UPDATE orders
SET estado = UPPER(LEFT(TRIM(state), 2))
WHERE estado IS NULL AND state IS NOT NULL AND LENGTH(TRIM(state)) >= 2;

CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);
CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON orders(payment_type);

-- Cache Meta Ads (15 min)
CREATE TABLE IF NOT EXISTS meta_ads_cache (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from  date        NOT NULL,
  period_to    date        NOT NULL,
  data         jsonb       NOT NULL DEFAULT '{}',
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_from, period_to)
);

CREATE INDEX IF NOT EXISTS meta_ads_cache_fetched_idx ON meta_ads_cache (fetched_at DESC);

-- Agendamentos (leads atendidos / PayAfter)
CREATE TABLE IF NOT EXISTS appointments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid        REFERENCES orders(id) ON DELETE SET NULL,
  seller_id     uuid        REFERENCES sellers(id) ON DELETE SET NULL,
  customer_name text,
  payment_type  varchar(20) NOT NULL DEFAULT 'payafter',
  status        varchar(20) NOT NULL DEFAULT 'agendado',
  scheduled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_created_at_idx ON appointments (created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_payment_type_idx ON appointments (payment_type);
CREATE INDEX IF NOT EXISTS appointments_order_id_idx ON appointments (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_order_id_uniq ON appointments (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE meta_ads_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
