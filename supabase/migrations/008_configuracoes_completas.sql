-- Dashboard X1 — Configurações completas: multi-BM, Payt, Braip, chave global
-- Execute no SQL Editor do Supabase

-- Ajustar ad_accounts para multi-BM (estrutura flat igual ao Track Pro)
ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS bm_id VARCHAR(100);
ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS bm_name VARCHAR(200);

-- Chave de segurança global dos webhooks
CREATE TABLE IF NOT EXISTS webhook_config (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  secret_key  VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO webhook_config (secret_key)
SELECT encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM webhook_config);

ALTER TABLE webhook_config DISABLE ROW LEVEL SECURITY;

-- Pagamentos Payt
CREATE TABLE IF NOT EXISTS payt_payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  VARCHAR(100) UNIQUE,
  customer_name   VARCHAR(200),
  customer_email  VARCHAR(200),
  customer_phone  VARCHAR(30),
  customer_doc    VARCHAR(20),
  amount          NUMERIC(10,2),
  status          VARCHAR(50),
  payment_method  VARCHAR(50),
  product_name    VARCHAR(200),
  product_id      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  payload         JSONB
);

ALTER TABLE payt_payments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payt_transaction ON payt_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payt_status ON payt_payments(status);
CREATE INDEX IF NOT EXISTS idx_payt_created ON payt_payments(created_at DESC);

-- Pagamentos Braip
CREATE TABLE IF NOT EXISTS braip_payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  VARCHAR(100) UNIQUE,
  customer_name   VARCHAR(200),
  customer_email  VARCHAR(200),
  customer_phone  VARCHAR(30),
  customer_doc    VARCHAR(20),
  amount          NUMERIC(10,2),
  status          VARCHAR(50),
  payment_method  VARCHAR(50),
  product_name    VARCHAR(200),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  payload         JSONB
);

ALTER TABLE braip_payments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_braip_transaction ON braip_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_braip_status ON braip_payments(status);
CREATE INDEX IF NOT EXISTS idx_braip_created ON braip_payments(created_at DESC);
