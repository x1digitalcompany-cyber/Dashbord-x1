import type { KanbanColumns, KanbanColumn, KanbanOrder } from "@/types";

export async function fetchKanbanOrders(from: Date, to: Date): Promise<KanbanColumns> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`/api/dashboard/kanban?${params}`);
  if (!res.ok) throw new Error("Falha ao buscar pedidos do Kanban");
  return res.json();
}

export async function moveKanbanOrder(
  orderId: string,
  newColumn: KanbanColumn
): Promise<KanbanOrder> {
  const res = await fetch("/api/dashboard/kanban", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, column: newColumn }),
  });
  if (!res.ok) throw new Error("Falha ao mover pedido");
  return res.json();
}
