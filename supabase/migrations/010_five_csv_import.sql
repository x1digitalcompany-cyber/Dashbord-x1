-- Dashboard X1 — Importação CSV Five: rastreio de origem + data aprovação pagamento
-- Execute no SQL Editor do Supabase

ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(20) DEFAULT 'webhook';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_aprovacao_pagamento TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_last_sync_source ON orders(last_sync_source);
