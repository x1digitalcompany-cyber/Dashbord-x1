import type { KanbanColumn, KanbanColumns, KanbanMetrics, KanbanOrder, KanbanOperationType } from "@/types";

export const KANBAN_COLUMNS: KanbanColumn[] = [
  "pedidos_criados",
  "em_transito",
  "retirar_correios",
  "requer_atencao",
  "entregue",
  "pagos",
  "devolvidos",
  "inadimplentes",
];

export const ANTECIPADO_VALID_COLUMNS: KanbanColumn[] = [
  "pedidos_criados", "em_transito", "retirar_correios", "requer_atencao", "devolvidos", "entregue",
];

export const AGENDADO_VALID_COLUMNS: KanbanColumn[] = [
  "pedidos_criados", "em_transito", "retirar_correios", "requer_atencao", "entregue", "pagos", "devolvidos", "inadimplentes",
];

export function validColumnsForTipo(tipo: KanbanOperationType): KanbanColumn[] {
  return tipo === "antecipado" ? ANTECIPADO_VALID_COLUMNS : AGENDADO_VALID_COLUMNS;
}

export function isKanbanColumn(value: string): value is KanbanColumn {
  return (KANBAN_COLUMNS as string[]).includes(value);
}

export function flattenKanbanColumns(columns: KanbanColumns): KanbanOrder[] {
  return KANBAN_COLUMNS.flatMap((col) => columns[col] ?? []);
}

export function filterKanbanOrders(orders: KanbanOrder[], search: string): KanbanOrder[] {
  const q = search.trim().toLowerCase().replace(/^#/, "");
  if (!q) return orders;
  return orders.filter(
    (p) =>
      p.customerName.toLowerCase().includes(q) ||
      (p.displayId?.toLowerCase().includes(q) ?? false) ||
      p.orderNumber.toLowerCase().includes(q) ||
      (p.trackingCode?.toLowerCase().includes(q) ?? false) ||
      (p.sellerName?.toLowerCase().includes(q) ?? false)
  );
}

export function applyKanbanSearch(
  columns: KanbanColumns,
  search: string
): KanbanColumns {
  const filtered = filterKanbanOrders(flattenKanbanColumns(columns), search);
  const next = Object.fromEntries(
    KANBAN_COLUMNS.map((col) => [col, [] as KanbanOrder[]])
  ) as KanbanColumns;
  for (const order of filtered) {
    const col = isKanbanColumn(order.status) ? order.status : "pedidos_criados";
    next[col].push(order);
  }
  return next;
}

export function computeKanbanMetrics(
  columns: KanbanColumns,
  search = ""
): KanbanMetrics {
  const all = filterKanbanOrders(flattenKanbanColumns(columns), search);
  return {
    total: all.length,
    paidValue: all.filter((o) => o.status === "pagos").reduce((s, o) => s + o.value, 0),
    inadimplentesCount: all.filter((o) => o.status === "inadimplentes").length,
    emTransitoCount: all.filter((o) => o.status === "em_transito").length,
    requerAtencaoCount: all.filter((o) => o.status === "requer_atencao").length,
  };
}
