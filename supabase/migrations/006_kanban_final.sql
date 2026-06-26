-- MIGRATION 006 — Kanban Final
-- Antecipado: 6 colunas (sem pagos/inadimplentes)
-- Agendado:   8 colunas (entregue = aguardando pagamento)

-- 1. Requer Atenção: retirar_correios com tracking_code (heurística DELIVERY_FAILED)
UPDATE orders SET kanban_status = 'requer_atencao'
WHERE kanban_status = 'retirar_correios'
AND tracking_code IS NOT NULL;

-- 2. Antecipado: pagos → entregue (antecipado não tem coluna pagos)
UPDATE orders SET kanban_status = 'entregue'
WHERE kanban_status = 'pagos'
AND payment_type = 'antecipado';

-- 3. Legado chegou → pedidos_criados
UPDATE orders SET kanban_status = 'pedidos_criados'
WHERE kanban_status = 'chegou';

-- 4. Conferir resultado
SELECT kanban_status, payment_type, COUNT(*) AS total
FROM orders
GROUP BY kanban_status, payment_type
ORDER BY payment_type, kanban_status;
