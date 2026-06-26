-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004 — Campos reais do payload Five
-- Baseado nos payloads reais analisados de ORDER_CREATE e SHIPPING_UPDATE
-- ═══════════════════════════════════════════════════════════════════════════

-- Código curto de exibição: últimos 8 chars do orderId (UUID) em maiúsculo
-- Ex: "e3f41cad-5db4-4893-9137-99d09077c239" → "99D09077"
ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_id VARCHAR(20);

-- Nome do vendedor (payload.author.name do ORDER_CREATE — vem null nos SHIPPING_UPDATE)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);

-- Documento do cliente (payload.customer.document)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_doc VARCHAR(20);

-- Telefone do cliente — IF NOT EXISTS para não conflitar se já existir
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);

-- Cidade e CEP — IF NOT EXISTS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);

-- Endereço completo formatado (logradouro + bairro)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_full TEXT;

-- Título da oferta (payload.product.offer.title)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_title VARCHAR(255);

-- Transportadora (payload.shipping.platform)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_platform VARCHAR(80);

-- Nome do projeto (payload.project.name)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project_name VARCHAR(100);

-- Método de pagamento (payload.charge.paymentMethod) — IF NOT EXISTS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- ── Preencher display_id nos registros existentes ──────────────────────────
UPDATE orders
SET display_id = UPPER(RIGHT(order_number, 8))
WHERE display_id IS NULL
  AND order_number IS NOT NULL;

-- ── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_display_id   ON orders(display_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_name  ON orders(seller_name);
CREATE INDEX IF NOT EXISTS idx_orders_project_name ON orders(project_name);
