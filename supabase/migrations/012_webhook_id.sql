-- Dashboard X1 — URLs de webhook permanentes (webhook_id fixo, separado do secret)
-- Execute no SQL Editor do Supabase

ALTER TABLE webhook_config ADD COLUMN IF NOT EXISTS webhook_id UUID DEFAULT gen_random_uuid();

-- Garantir que existe apenas uma linha
INSERT INTO webhook_config (secret_key)
SELECT encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM webhook_config);

-- Se já existe mas webhook_id é nulo, preencher
UPDATE webhook_config SET webhook_id = gen_random_uuid() WHERE webhook_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_config_webhook_id ON webhook_config(webhook_id);

-- Verificar resultado:
SELECT webhook_id, LEFT(secret_key, 8) || '...' AS secret_preview FROM webhook_config;
