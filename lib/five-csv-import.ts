import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FivePaymentType } from "@/lib/five-webhook";
import {
  applyKanbanLocks,
  isFivePaidEmail,
  isFiveTestOrder,
  mapShippingStatusToKanban,
} from "@/lib/five-kanban-map";
import { normalizeUf } from "@/lib/finance";
import type { KanbanColumn } from "@/types";

export const FIVE_CSV_REQUIRED_HEADERS = [
  "id",
  "cliente",
  "statusEnvio",
  "valorTotal",
] as const;

export const FIVE_CSV_MAX_BYTES = 10 * 1024 * 1024;
export const FIVE_CSV_BATCH_SIZE = 50;

export interface FiveCsvRow {
  id: string;
  previewId?: string;
  createdAt?: string;
  autor?: string;
  cliente?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  produto?: string;
  oferta?: string;
  valorTotal?: string;
  formaPagamento?: string;
  statusPagamento?: string;
  statusPedido?: string;
  statusEnvio?: string;
  codigoEnvio?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  atualizadoEm?: string;
  dataAprovacaoPagamento?: string;
}

export interface FiveCsvImportSummary {
  criados: number;
  atualizados: number;
  ignorados_teste: number;
  erros: { linha: number; id?: string; mensagem: string }[];
  total: number;
}

export interface ExistingCsvOrder {
  id: string;
  order_number: string;
  kanban_status: KanbanColumn;
  payment_type: FivePaymentType | string;
  seller_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_doc: string | null;
  address_full: string | null;
  city: string | null;
  state: string | null;
  estado: string | null;
  zip_code: string | null;
  tracking_code: string | null;
  offer_title: string | null;
  display_id: string | null;
  paid_at: string | null;
}

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function coalesceField(
  incoming: string | null | undefined,
  existing: string | null | undefined
): string | null {
  const inc = incoming?.trim();
  if (inc) return inc;
  const ex = existing?.trim();
  return ex || null;
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

function titleName(name: string): string {
  return name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function parseFiveCsvDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const m = raw
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const date = new Date(
    `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCsvValue(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function buildAddressFull(row: FiveCsvRow): string | null {
  const parts = [
    clean(row.rua),
    clean(row.numero),
    clean(row.complemento),
    clean(row.bairro),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function validateFiveCsvContent(csvText: string): {
  ok: true;
  rows: FiveCsvRow[];
} | {
  ok: false;
  error: string;
} {
  const parsed = Papa.parse<FiveCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return {
      ok: false,
      error: `Erro ao ler CSV na linha ${first.row ?? "?"}: ${first.message}`,
    };
  }

  const headers = parsed.meta.fields ?? [];
  const missing = FIVE_CSV_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      error: "Arquivo não é um relatório válido da Five.",
    };
  }

  return { ok: true, rows: parsed.data };
}

const ORDER_SELECT =
  "id, order_number, kanban_status, payment_type, seller_name, customer_name, " +
  "customer_email, customer_phone, customer_doc, address_full, city, state, estado, " +
  "zip_code, tracking_code, offer_title, display_id, paid_at";

export async function findExistingCsvOrder(
  supabase: SupabaseClient,
  row: FiveCsvRow
): Promise<ExistingCsvOrder | null> {
  const orderNumber = clean(row.id);
  if (!orderNumber) return null;

  const { data: byId, error: byIdError } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (byIdError) throw byIdError;
  if (byId) return byId as unknown as ExistingCsvOrder;

  const createdAt = parseFiveCsvDate(row.createdAt);
  const cpf = clean(row.cpf);
  const produto = clean(row.produto);
  const valor = parseCsvValue(row.valorTotal);

  if (!createdAt || !cpf || !produto) return null;

  const windowStart = new Date(createdAt.getTime() - 5 * 60 * 1000).toISOString();
  const windowEnd = new Date(createdAt.getTime() + 5 * 60 * 1000).toISOString();

  const { data: candidates, error: fallbackError } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_doc", cpf)
    .eq("product_name", produto)
    .eq("value", valor)
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd)
    .limit(1);

  if (fallbackError) throw fallbackError;
  return (candidates?.[0] as unknown as ExistingCsvOrder | undefined) ?? null;
}

export function buildCsvOrderPayload(
  row: FiveCsvRow,
  existing: ExistingCsvOrder | null,
  newPaymentType: FivePaymentType
) {
  const orderNumber = clean(row.id);
  const email = clean(row.email);
  const paymentType = (existing?.payment_type as FivePaymentType) || newPaymentType;
  const statusEnvio = clean(row.statusEnvio);
  const statusPedido = clean(row.statusPedido);
  const statusPagamento = clean(row.statusPagamento);

  const kanbanProposed = mapShippingStatusToKanban(
    statusEnvio,
    statusPedido,
    email,
    paymentType,
    statusPagamento
  );
  const kanbanStatus = applyKanbanLocks(
    kanbanProposed,
    existing?.kanban_status ?? null
  );

  const createdAt = parseFiveCsvDate(row.createdAt);
  const updatedAt = parseFiveCsvDate(row.atualizadoEm) ?? new Date();
  const dataAprovacao = parseFiveCsvDate(row.dataAprovacaoPagamento);
  const paid =
    isFivePaidEmail(email) || statusPagamento.toUpperCase() === "PAID";

  let paidAt = existing?.paid_at ?? null;
  if (paid && statusEnvio.toUpperCase() === "DELIVERED" && !paidAt) {
    paidAt = (dataAprovacao ?? updatedAt).toISOString();
  }

  const incomingAddress = buildAddressFull(row);
  const estado = normalizeUf(clean(row.estado));

  return {
    order_number: orderNumber,
    display_id: coalesceField(clean(row.previewId), existing?.display_id),
    customer_name: titleName(clean(row.cliente) || existing?.customer_name || "Cliente"),
    customer_email: coalesceField(email, existing?.customer_email),
    customer_phone: coalesceField(
      normalizePhone(clean(row.telefone)),
      existing?.customer_phone
    ),
    customer_doc: coalesceField(clean(row.cpf), existing?.customer_doc),
    value: parseCsvValue(row.valorTotal),
    payment_method: clean(row.formaPagamento) || "PIX",
    gateway: "five",
    kanban_status: kanbanStatus,
    product_name: clean(row.produto) || "Produto Five",
    offer_title: coalesceField(clean(row.oferta), existing?.offer_title),
    tracking_code: clean(row.codigoEnvio) || null,
    city: coalesceField(clean(row.cidade), existing?.city),
    state: coalesceField(clean(row.estado), existing?.state),
    zip_code: coalesceField(clean(row.cep), existing?.zip_code),
    address_full: coalesceField(incomingAddress, existing?.address_full),
    estado,
    seller_name: coalesceField(clean(row.autor), existing?.seller_name),
    payment_type: paymentType,
    paid_at: paidAt,
    data_aprovacao_pagamento: dataAprovacao?.toISOString() ?? null,
    created_at: createdAt?.toISOString() ?? undefined,
    updated_at: updatedAt.toISOString(),
    last_sync_source: "csv_import" as const,
  };
}

export async function processFiveCsvRows(
  supabase: SupabaseClient,
  rows: FiveCsvRow[],
  newPaymentType: FivePaymentType,
  onProgress?: (processed: number, total: number) => void
): Promise<FiveCsvImportSummary> {
  const summary: FiveCsvImportSummary = {
    criados: 0,
    atualizados: 0,
    ignorados_teste: 0,
    erros: [],
    total: rows.length,
  };

  for (let i = 0; i < rows.length; i += FIVE_CSV_BATCH_SIZE) {
    const batch = rows.slice(i, i + FIVE_CSV_BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const lineNumber = i + j + 2;
      const row = batch[j];

      try {
        if (
          isFiveTestOrder({
            customerName: row.cliente,
            customerEmail: row.email,
            customerDoc: row.cpf,
            productName: row.produto,
          })
        ) {
          summary.ignorados_teste += 1;
          continue;
        }

        const orderNumber = clean(row.id);
        if (!orderNumber) {
          summary.erros.push({
            linha: lineNumber,
            mensagem: "Linha sem id (order_number).",
          });
          continue;
        }

        const existing = await findExistingCsvOrder(supabase, row);
        const payload = buildCsvOrderPayload(row, existing, newPaymentType);

        if (existing) {
          const { created_at: _createdAt, ...updatePayload } = payload;
          const { error } = await supabase
            .from("orders")
            .update(updatePayload)
            .eq("id", existing.id);
          if (error) throw error;
          summary.atualizados += 1;
        } else {
          const { error } = await supabase.from("orders").insert({
            ...payload,
            webhook_source: newPaymentType,
          });
          if (error) throw error;
          summary.criados += 1;
        }
      } catch (err) {
        summary.erros.push({
          linha: lineNumber,
          id: clean(row.id) || undefined,
          mensagem: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    onProgress?.(Math.min(i + batch.length, rows.length), rows.length);

    if (rows.length > 1000) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return summary;
}
