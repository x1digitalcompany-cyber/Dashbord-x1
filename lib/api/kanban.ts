import type { KanbanColumn, KanbanColumns, KanbanOperationType } from "@/types";

export function buildKanbanUrl(
  tipo: KanbanOperationType,
  sellerName: string | null = null
): string {
  const params = new URLSearchParams({ tipo });
  if (sellerName) {
    params.set("seller", sellerName);
  }
  return `/api/dashboard/kanban?${params}`;
}

export async function fetchKanbanBoard(
  tipo: KanbanOperationType,
  sellerName: string | null = null,
  signal?: AbortSignal
): Promise<{ columns: KanbanColumns; metrics: import("@/types").KanbanMetrics }> {
  const res = await fetch(buildKanbanUrl(tipo, sellerName), { signal });
  if (!res.ok) throw new Error("Falha ao buscar pedidos do Kanban");
  return res.json();
}

export async function moveKanbanOrder(
  orderId: string,
  newColumn: KanbanColumn
): Promise<{ id: string; kanban_status: string }> {
  const res = await fetch("/api/dashboard/kanban", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, column: newColumn }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Falha ao mover pedido");
  }
  return res.json();
}
