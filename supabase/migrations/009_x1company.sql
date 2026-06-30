-- Dashboard X1 — Gateway X1Company (postback mesmo padrão Payt, tabela própria)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS x1company_payments (
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

ALTER TABLE x1company_payments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_x1company_transaction ON x1company_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_x1company_status ON x1company_payments(status);
CREATE INDEX IF NOT EXISTS idx_x1company_created ON x1company_payments(created_at DESC);
