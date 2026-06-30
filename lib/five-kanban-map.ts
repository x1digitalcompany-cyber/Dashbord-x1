import type { KanbanColumn } from "@/types";
import type { FivePaymentType } from "@/lib/five-webhook";

export function isFivePaidEmail(email: string): boolean {
  return email.trim().toLowerCase() === "pago@gmail.com";
}

export function isFiveTestOrder(params: {
  customerName?: string;
  customerEmail?: string;
  customerDoc?: string;
  productName?: string;
}): boolean {
  const email = (params.customerEmail ?? "").toLowerCase().trim();
  const name = (params.customerName ?? "").toLowerCase().trim();
  const docRaw = (params.customerDoc ?? "").trim();
  const doc = docRaw.replace(/\D/g, "");
  const product = (params.productName ?? "").trim();
  return (
    email === "cliente@example.com" ||
    name.includes("cliente fict") ||
    doc === "12345678900" ||
    docRaw === "123.456.789-00" ||
    product.toLowerCase() === "produto demo"
  );
}

/**
 * Fonte única de verdade: status de envio/pedido Five → coluna do Kanban.
 * Usada pelo webhook e pela importação CSV.
 */
export function mapShippingStatusToKanban(
  statusEnvio: string,
  statusPedido: string,
  customerEmail: string,
  paymentType: FivePaymentType,
  statusPagamento?: string
): KanbanColumn {
  const pedido = statusPedido.trim().toUpperCase();
  if (pedido === "CANCELED") return "devolvidos";

  const shipping = statusEnvio.trim().toUpperCase();
  const paid =
    isFivePaidEmail(customerEmail) ||
    statusPagamento?.trim().toUpperCase() === "PAID";

  if (shipping === "IM_PREPARING" || shipping === "ORDER_CREATE" || !shipping) {
    return "pedidos_criados";
  }

  if (["NOT_DELIVERED", "RETURNED", "RETURNING_TO_ORIGIN"].includes(shipping)) {
    return "devolvidos";
  }

  if (shipping === "DELIVERY_FAILED" || shipping === "TAG_EXPIRED") {
    return "requer_atencao";
  }

  if (
    [
      "READY_FOR_PICKUP",
      "AWAITING_PICKUP",
      "AVAILABLE_FOR_PICKUP",
      "WAITING_PICKUP",
      "POST_OFFICE",
    ].includes(shipping)
  ) {
    return "retirar_correios";
  }

  if (shipping === "DELIVERED") {
    if (paymentType === "agendado") {
      return paid ? "pagos" : "entregue";
    }
    return "entregue";
  }

  if (
    [
      "SENDED",
      "IN_TRANSIT",
      "POSTED",
      "SHIPPED",
      "IN_TRANSIT_TO_DELIVERY",
      "OUT_FOR_DELIVERY",
    ].includes(shipping)
  ) {
    return "em_transito";
  }

  return "pedidos_criados";
}

export function applyKanbanLocks(
  proposed: KanbanColumn,
  existing: KanbanColumn | null | undefined
): KanbanColumn {
  if (!existing) return proposed;

  if (existing === "devolvidos" && proposed !== "devolvidos") {
    return "devolvidos";
  }

  const terminalExisting = existing === "pagos" || existing === "entregue";
  const allowedFromTerminal: KanbanColumn[] = [
    "pagos",
    "entregue",
    "devolvidos",
    "requer_atencao",
  ];
  if (terminalExisting && !allowedFromTerminal.includes(proposed)) {
    return existing;
  }

  return proposed;
}
