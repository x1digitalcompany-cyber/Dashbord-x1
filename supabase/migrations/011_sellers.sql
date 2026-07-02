-- 011_sellers.sql
-- Tabela de vendedores integrada com orders.seller_name (Five webhook)

CREATE TABLE IF NOT EXISTS sellers (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  email          VARCHAR(200),
  phone          VARCHAR(30),
  cpf            VARCHAR(20),
  is_active      BOOLEAN DEFAULT true,
  modelo_salario VARCHAR(30) DEFAULT 'so_comissao'
                 CHECK (modelo_salario IN ('fixo_mais_comissao', 'so_comissao')),
  meta_mensal    NUMERIC(10,2) DEFAULT 0,
  meta           JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;

-- Adiciona constraint UNIQUE (name) de forma idempotente
-- (necessário caso a tabela já existia sem o constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sellers_name_key'
      AND conrelid = 'sellers'::regclass
  ) THEN
    ALTER TABLE sellers ADD CONSTRAINT sellers_name_key UNIQUE (name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sellers_name   ON sellers(name);
CREATE INDEX IF NOT EXISTS idx_sellers_active ON sellers(is_active);

-- Popular com vendedores que já venderam pela Five
INSERT INTO sellers (name)
SELECT DISTINCT seller_name FROM orders
WHERE seller_name IS NOT NULL AND seller_name != ''
ON CONFLICT (name) DO NOTHING;
