/**
 * Parsers Payt e Braip — replicados do X1 Track Pro (purchase-webhook.ts)
 * Sem CAPI / leads / afiliados.
 */

export interface ParsedPayment {
  transaction_id: string | null;
  status: "approved" | "refunded" | "pending" | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_doc: string | null;
  amount: number;
  payment_method: string | null;
  product_name: string | null;
  product_id: string | null;
}

function setNestedValue(
  obj: Record<string, unknown>,
  parts: string[],
  value: unknown
): void {
  const head = parts[0];
  if (parts.length === 1) {
    obj[head] = value;
    return;
  }
  const nextIsIndex = /^\d+$/.test(parts[1]);
  if (nextIsIndex) {
    if (!Array.isArray(obj[head])) obj[head] = [];
    const arr = obj[head] as Array<Record<string, unknown>>;
    const idx = parseInt(parts[1]);
    if (arr[idx] == null) arr[idx] = {};
    setNestedValue(arr[idx], parts.slice(2), value);
  } else {
    if (obj[head] == null || typeof obj[head] !== "object" || Array.isArray(obj[head])) {
      obj[head] = {};
    }
    setNestedValue(obj[head] as Record<string, unknown>, parts.slice(1), value);
  }
}

export function unflattenPayt(body: Record<string, unknown>): Record<string, unknown> {
  if (!Object.keys(body).some((k) => k.includes("."))) return body;
  if (body.customer != null || body.transaction != null) return body;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!key.includes(".")) {
      result[key] = value;
    } else {
      setNestedValue(result, key.split("."), value);
    }
  }
  return result;
}

export function isLuminarPayload(body: Record<string, unknown>): boolean {
  return (
    String(body?.integration_key ?? "").toLowerCase().includes("luminar") ||
    (body?.transaction as Record<string, unknown> | undefined)?.net_profit != null
  );
}

export function resolvePaytValueReais(body: Record<string, unknown>): number {
  const participants: Array<{ type?: string; amount?: number }> =
    (body?.commission as Array<{ type?: string; amount?: number }>) ??
    (body?.participants as Array<{ type?: string; amount?: number }>) ??
    (body?.commissions as Array<{ type?: string; amount?: number }>) ??
    (body?.recipients as Array<{ type?: string; amount?: number }>) ??
  (body?.transaction as Record<string, unknown> | undefined)?.commission ??
    [];
  const producer = Array.isArray(participants)
    ? participants.find((p) => p?.type === "producer")
    : null;
  const producerCents = producer?.amount ? Number(producer.amount) : 0;
  if (producerCents > 0) return producerCents / 100;

  const tx = body?.transaction as Record<string, unknown> | undefined;
  const fallbackCents =
    Number(tx?.price_without_installments) || Number(tx?.total_price) || 0;
  if (fallbackCents > 0) return fallbackCents / 100;

  return Number(
    body?.amount ??
      body?.value ??
      tx?.amount ??
      (body?.price as Record<string, unknown> | undefined)?.value ??
      0
  );
}

export function resolveLuminarValueReais(body: Record<string, unknown>): number {
  const tx = body?.transaction as Record<string, unknown> | undefined;
  const netProfitCents = Number(tx?.net_profit ?? body?.net_profit ?? 0);
  if (netProfitCents > 0) return netProfitCents / 100;

  const fallbackCents =
    Number(tx?.net_amount) ||
    Number(tx?.price_without_installments) ||
    Number(tx?.total_price) ||
    0;
  return fallbackCents > 0 ? fallbackCents / 100 : 0;
}

export function resolvePurchaseValueReais(body: Record<string, unknown>): number {
  return isLuminarPayload(body) ? resolveLuminarValueReais(body) : resolvePaytValueReais(body);
}

export function parsePaytPayment(rawBody: Record<string, unknown>): ParsedPayment {
  const body = unflattenPayt(rawBody) as Record<string, unknown>;
  const tx = body?.transaction as Record<string, unknown> | undefined;
  const customer = (body?.customer ?? body?.buyer ?? body?.client) as
    | Record<string, unknown>
    | undefined;

  const transaction_id = String(
    body?.transaction_id ?? tx?.id ?? body?.order_id ?? body?.id ?? ""
  ).trim() || null;

  const rawStatus = String(
    body?.status ?? tx?.status ?? body?.order_status ?? body?.payment_status ?? ""
  ).toLowerCase();

  let status: ParsedPayment["status"] = null;
  if (["approved", "paid", "complete", "completed", "success", "pago", "aprovado"].includes(rawStatus)) {
    status = "approved";
  } else if (["refunded", "cancelled", "canceled", "chargeback", "protest"].includes(rawStatus)) {
    status = "refunded";
  } else if (["pending", "waiting", "processing"].includes(rawStatus)) {
    status = "pending";
  }

  const product = (body?.product ?? body?.item) as Record<string, unknown> | undefined;
  const billing = (customer?.billing_address ?? customer?.address ?? body?.address) as
    | Record<string, unknown>
    | undefined;

  return {
    transaction_id,
    status,
    customer_name: customer?.name ? String(customer.name) : null,
    customer_email: customer?.email ? String(customer.email) : null,
    customer_phone: customer?.phone
      ? String(customer.phone)
      : customer?.phone_number
        ? String(customer.phone_number)
        : null,
    customer_doc: customer?.document
      ? String(customer.document)
      : customer?.cpf
        ? String(customer.cpf)
        : null,
    amount: resolvePurchaseValueReais(body),
    payment_method: body?.payment_method ? String(body.payment_method) : null,
    product_name: product?.name ? String(product.name) : null,
    product_id: product?.id ? String(product.id) : null,
  };
}

export function parseBraipPayment(body: Record<string, unknown>): ParsedPayment {
  const transaction_id = String(
    body?.trans_key ??
      (body?.trans as Record<string, unknown> | undefined)?.key ??
      body?.order_id ??
      body?.id ??
      ""
  ).trim() || null;

  const rawStatus = String(body?.status ?? body?.trans_status ?? "").toLowerCase();
  let status: ParsedPayment["status"] = null;
  if (["2", "paid", "approved"].includes(rawStatus)) {
    status = "approved";
  } else if (["refunded", "cancelled", "canceled", "chargeback"].includes(rawStatus)) {
    status = "refunded";
  } else if (["pending", "waiting", "processing"].includes(rawStatus)) {
    status = "pending";
  }

  const client = (body?.client ?? body?.customer) as Record<string, unknown> | undefined;
  const product = (body?.product ?? body?.item) as Record<string, unknown> | undefined;
  const trans = body?.trans as Record<string, unknown> | undefined;

  return {
    transaction_id,
    status,
    customer_name: client?.name ? String(client.name) : null,
    customer_email: client?.email ? String(client.email) : null,
    customer_phone: client?.cellphone
      ? String(client.cellphone)
      : client?.phone
        ? String(client.phone)
        : null,
    customer_doc: client?.document ? String(client.document) : null,
    amount: Number(body?.trans_value ?? trans?.value ?? body?.amount ?? 0),
    payment_method: body?.payment_method ? String(body.payment_method) : null,
    product_name: product?.name ? String(product.name) : null,
    product_id: product?.id ? String(product.id) : null,
  };
}
