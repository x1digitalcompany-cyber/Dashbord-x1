import type { KanbanColumn } from "@/types";

export type FivePaymentType = "antecipado" | "agendado";

/** Tipos legados ainda aceitos em leitura. */
export const AGENDADO_PAYMENT_TYPES = ["agendado", "payafter"] as const;
import { normalizeUf } from "@/lib/finance";

/** Colunas internas do fluxo Five (espelho do Apps Script de referência). */
type FiveInternalColumn =
  | "Pedido Criado"
  | "Transito"
  | "Saiu para entrega"
  | "Retirar Correios"
  | "Entregue"
  | "Devolvido"
  | "Cobrança"
  | "Reenviado"
  | "Concluido";

export type FiveWebhookPayload = Record<string, unknown>;

export interface FiveColumnDecision {
  column: FiveInternalColumn;
  label: string;
  priority: boolean;
  message: string;
}

export interface FiveUpsertResult {
  orderNumber: string;
  action: "upsert" | "ignored";
  kanbanStatus: KanbanColumn;
  message: string;
}

function get(obj: unknown, path: string): string {
  const parts = path.split(".");
  let acc: unknown = obj;
  for (const key of parts) {
    if (!acc || typeof acc !== "object") return "";
    acc = (acc as Record<string, unknown>)[key];
  }
  if (acc == null) return "";
  return String(acc).trim();
}

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function isPaid(email: string): boolean {
  return email.trim().toLowerCase() === "pago@gmail.com";
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

function titleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function parsePrice(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function extractPaymentType(
  payload: FiveWebhookPayload,
  forced?: FivePaymentType
): FivePaymentType {
  if (forced) return forced;

  const raw = clean(
    get(payload, "payment.type") ||
      get(payload, "product.offer.paymentType") ||
      get(payload, "product.paymentType") ||
      payload.paymentType
  ).toLowerCase();

  if (/antecip|upfront|pre.?pay|vista/.test(raw)) return "antecipado";
  if (/payafter|pay.?after|agendad|agendamento|pos/.test(raw)) return "agendado";

  const email = clean(get(payload, "customer.mail"));
  if (isPaid(email)) return "antecipado";
  return "agendado";
}

export function extractOrderId(payload: FiveWebhookPayload): string {
  return clean(payload.orderId) || get(payload, "order.id");
}

export function validateFivePayload(payload: unknown): {
  ok: true;
  data: FiveWebhookPayload;
} | {
  ok: false;
  error: string;
} {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const data = payload as FiveWebhookPayload;
  const action = clean(data.action).toLowerCase();

  // Ações manuais do painel antigo não chegam via webhook Five
  if (action && ["move", "tags", "tag", "delete", "bulk_move", "obfuscate_phone"].includes(action)) {
    return { ok: false, error: `Ação "${action}" não é suportada neste webhook.` };
  }

  const orderId = extractOrderId(data);
  if (!orderId) {
    return { ok: false, error: "Payload sem orderId (ou order.id)." };
  }

  return { ok: true, data };
}

export function decideFiveColumn(
  payload: FiveWebhookPayload,
  existingKanban: KanbanColumn | null
): FiveColumnDecision {
  const eventName = clean(payload.event);
  const shippingStatus = clean(
    payload.shippingStatus ||
      get(payload, "shipping.shippingStatus") ||
      payload.eventStatus
  ).toUpperCase();

  const email = clean(get(payload, "customer.mail"));
  const paid = isPaid(email);

  if (eventName === "ORDER_CREATE") {
    return {
      column: "Pedido Criado",
      label: "Pedido criado",
      priority: false,
      message: "Pedido criado na Five.",
    };
  }

  if (["NOT_DELIVERED", "RETURNED", "RETURNING_TO_ORIGIN"].includes(shippingStatus)) {
    return {
      column: "Devolvido",
      label: shippingStatus === "NOT_DELIVERED" ? "Não entregue" : shippingStatus,
      priority: shippingStatus === "NOT_DELIVERED",
      message: "Pedido movido para Devolvido.",
    };
  }

  if (shippingStatus === "DELIVERY_FAILED") {
    return {
      column: "Retirar Correios",
      label: "Falha na entrega",
      priority: true,
      message: "Falha na entrega: acompanhar com prioridade.",
    };
  }

  if (
    [
      "READY_FOR_PICKUP",
      "AWAITING_PICKUP",
      "AVAILABLE_FOR_PICKUP",
      "WAITING_PICKUP",
      "POST_OFFICE",
    ].includes(shippingStatus)
  ) {
    return {
      column: "Retirar Correios",
      label: "Retirar nos Correios",
      priority: false,
      message: "Pedido disponível para retirada nos Correios.",
    };
  }

  if (["IN_TRANSIT_TO_DELIVERY", "OUT_FOR_DELIVERY"].includes(shippingStatus)) {
    return {
      column: "Saiu para entrega",
      label: "Saiu para entrega",
      priority: false,
      message: "Pedido saiu para entrega.",
    };
  }

  if (shippingStatus === "DELIVERED") {
    return paid
      ? {
          column: "Entregue",
          label: "Entregue",
          priority: false,
          message: "Pedido entregue e pago.",
        }
      : {
          column: "Cobrança",
          label: "Entregue / cobrar",
          priority: true,
          message: "Pedido entregue com pagamento pendente.",
        };
  }

  if (["SENDED", "IN_TRANSIT", "POSTED", "SHIPPED"].includes(shippingStatus)) {
    return {
      column: "Transito",
      label: shippingStatus === "SENDED" ? "Enviado" : "Em trânsito",
      priority: false,
      message: "Pedido em trânsito.",
    };
  }

  return {
    column: mapKanbanToInternal(existingKanban) ?? "Pedido Criado",
    label: shippingStatus || eventName || "Status recebido",
    priority: false,
    message: "Status recebido sem regra específica; manteve/colocou no início.",
  };
}

function mapKanbanToInternal(kanban: KanbanColumn | null): FiveInternalColumn | null {
  if (!kanban) return null;
  const map: Record<KanbanColumn, FiveInternalColumn> = {
    chegou: "Pedido Criado",
    retirar_correios: "Retirar Correios",
    pagos: "Entregue",
    devolvidos: "Devolvido",
    inadimplentes: "Cobrança",
  };
  return map[kanban] ?? null;
}

export function mapFiveColumnToKanban(column: FiveInternalColumn): KanbanColumn {
  switch (column) {
    case "Retirar Correios":
      return "retirar_correios";
    case "Entregue":
    case "Concluido":
    case "Reenviado":
      return "pagos";
    case "Devolvido":
      return "devolvidos";
    case "Cobrança":
      return "inadimplentes";
    default:
      return "chegou";
  }
}

export interface ExistingOrderRow {
  kanban_status: KanbanColumn;
  customer_email: string | null;
  customer_phone?: string | null;
  tracking_code: string | null;
  paid_at: string | null;
}

export function buildOrderRecord(
  payload: FiveWebhookPayload,
  existing: ExistingOrderRow | null,
  forcedPaymentType?: FivePaymentType
): {
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  value: number;
  payment_method: string;
  gateway: string;
  kanban_status: KanbanColumn;
  product_name: string;
  tracking_code: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  estado: string | null;
  payment_type: FivePaymentType;
  paid_at: string | null;
} {
  const orderNumber = extractOrderId(payload);
  const decision = decideFiveColumn(payload, existing?.kanban_status ?? null);

  const lockedDevolvido =
    existing?.kanban_status === "devolvidos" && decision.column !== "Devolvido";
  const lockedManual =
    existing?.kanban_status === "pagos" &&
    !["Entregue", "Concluido", "Reenviado"].includes(decision.column);

  const finalInternal: FiveInternalColumn = lockedManual
    ? "Concluido"
    : lockedDevolvido
      ? "Devolvido"
      : decision.column;

  const kanbanStatus = mapFiveColumnToKanban(finalInternal);

  const email =
    clean(get(payload, "customer.mail")) || clean(existing?.customer_email);
  const phone = normalizePhone(
    clean(get(payload, "customer.phoneNumber")) ||
      clean(existing?.customer_phone ?? "")
  );
  const paid = isPaid(email);
  const shippingCode = clean(get(payload, "shipping.shippingCode"));
  const address = (payload.customer as Record<string, unknown> | undefined)
    ?.address as Record<string, unknown> | undefined;

  const shippingStatus = clean(
    payload.shippingStatus ||
      get(payload, "shipping.shippingStatus") ||
      payload.eventStatus
  ).toUpperCase();

  let paidAt = existing?.paid_at ?? null;
  if (paid && shippingStatus === "DELIVERED" && !paidAt) {
    paidAt = new Date().toISOString();
  }

  const rawState = clean(address?.state);
  const estado = normalizeUf(rawState);

  return {
    order_number: orderNumber,
    customer_name: titleName(
      clean(get(payload, "customer.name")) || "Cliente"
    ),
    customer_email: email || null,
    customer_phone: phone || null,
    value: parsePrice(clean(get(payload, "product.offer.price"))),
    payment_method: "PIX",
    gateway: "five",
    kanban_status: kanbanStatus,
    product_name:
      clean(get(payload, "product.name")) ||
      clean(get(payload, "product.offer.title")) ||
      "Produto Five",
    tracking_code: shippingCode || existing?.tracking_code || null,
    street: clean(address?.address) || null,
    neighborhood: clean(address?.neighborhood) || null,
    city: clean(address?.city) || null,
    state: clean(address?.state) || null,
    zip_code: clean(address?.zipCode) || null,
    estado,
    payment_type: extractPaymentType(payload, forcedPaymentType),
    paid_at: paidAt,
  };
}
