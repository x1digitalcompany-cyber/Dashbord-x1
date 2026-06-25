-- Dashboard X1 — Fase 6: webhooks duplos + logs

ALTER TABLE orders ADD COLUMN IF NOT EXISTS webhook_source VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON orders(payment_type);
CREATE INDEX IF NOT EXISTS idx_orders_webhook_source ON orders(webhook_source);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source VARCHAR(20) NOT NULL,
  order_number VARCHAR(50),
  payload JSONB,
  status_mapped VARCHAR(30),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

ALTER TABLE webhook_logs DISABLE ROW LEVEL SECURITY;

-- Normalizar payment_type legado
UPDATE orders SET payment_type = 'agendado' WHERE payment_type = 'payafter';
