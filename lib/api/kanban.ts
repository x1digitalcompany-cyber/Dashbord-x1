import type { KanbanColumn, KanbanColumns, KanbanOperationType } from "@/types";

export function buildKanbanUrl(
  tipo: KanbanOperationType,
  sellerIds: string[] = []
): string {
  const params = new URLSearchParams({ tipo });
  if (sellerIds.length > 0) {
    params.set("sellerIds", sellerIds.join(","));
  }
  return `/api/dashboard/kanban?${params}`;
}

export async function fetchKanbanBoard(
  tipo: KanbanOperationType,
  sellerIds: string[] = [],
  signal?: AbortSignal
): Promise<{ columns: KanbanColumns; metrics: import("@/types").KanbanMetrics }> {
  const res = await fetch(buildKanbanUrl(tipo, sellerIds), { signal });
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
