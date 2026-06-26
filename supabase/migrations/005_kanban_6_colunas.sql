-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005 — Kanban 6 colunas
-- Renomeia 'chegou' → 'pedidos_criados' e separa 'em_transito'
-- Ordem: pedidos_criados → em_transito → retirar_correios → pagos → devolvidos → inadimplentes
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Renomear 'chegou' para 'pedidos_criados' em todos os registros existentes
UPDATE orders
SET kanban_status = 'pedidos_criados'
WHERE kanban_status = 'chegou';

-- 2. Pedidos em 'pedidos_criados' que já têm código de rastreio → promover para 'em_transito'
--    (coluna do schema é tracking_code, não shipping_code)
UPDATE orders
SET kanban_status = 'em_transito'
WHERE kanban_status = 'pedidos_criados'
  AND tracking_code IS NOT NULL
  AND tracking_code != '';

-- 3. Atualizar o default da coluna kanban_status para o novo valor
ALTER TABLE orders
  ALTER COLUMN kanban_status SET DEFAULT 'pedidos_criados';
