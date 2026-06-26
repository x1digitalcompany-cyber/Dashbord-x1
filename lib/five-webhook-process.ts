/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FIVE WEBHOOK — DOCUMENTAÇÃO DO FORMATO REAL (baseado no Apps Script)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A Five envia POST com JSON puro. SEM header de autenticação.
 * Autenticação: secret como query param na URL cadastrada na Five.
 *   Ex: /api/webhooks/five/antecipado?secret=<FIVE_WEBHOOK_SECRET_ANTECIPADO>
 *
 * CAMPOS DO PAYLOAD:
 *   orderId                        string  — ID único do pedido (chave upsert)
 *   event                          string  — "ORDER_CREATE" ou vazio
 *   shippingStatus                 string  — status de envio (raiz do payload)
 *   eventStatus                    string  — alternativa ao shippingStatus
 *   customer.name                  string
 *   customer.mail                  string  — "pago@gmail.com" indica pago;
 *                                            qualquer outro = DELIVERED→Cobrança
 *   customer.phoneNumber           string
 *   customer.address.address       string  — logradouro
 *   customer.address.neighborhood  string  — bairro
 *   customer.address.city          string
 *   customer.address.state         string  — UF (ex: "SP")
 *   customer.address.zipCode       string
 *   product.name                   string
 *   product.offer.title            string
 *   product.offer.price            string  — valor monetário (ex: "99.90")
 *   shipping.shippingCode          string  — código de rastreio
 *   shipping.shippingStatus        string  — mesmo que raiz, lido como fallback
 *   shipping.platform              string  — transportadora
 *   project.name                   string
 *
 * LEITURA DE shippingStatus (por ordem de prioridade):
 *   payload.shippingStatus || payload.shipping.shippingStatus || payload.eventStatus
 *
 * MAPEAMENTO shippingStatus → kanban_status:
 *   ORDER_CREATE (event)              → chegou
 *   SENDED                            → chegou
 *   IN_TRANSIT                        → chegou
 *   POSTED / SHIPPED                  → chegou
 *   IN_TRANSIT_TO_DELIVERY            → chegou
 *   OUT_FOR_DELIVERY                  → chegou
 *   READY_FOR_PICKUP                  → retirar_correios
 *   AWAITING_PICKUP                   → retirar_correios
 *   AVAILABLE_FOR_PICKUP              → retirar_correios
 *   WAITING_PICKUP                    → retirar_correios
 *   POST_OFFICE                       → retirar_correios
 *   DELIVERY_FAILED                   → retirar_correios (prioridade alta)
 *   DELIVERED + mail=pago@gmail.com   → pagos
 *   DELIVERED + outro mail            → inadimplentes
 *   NOT_DELIVERED                     → devolvidos
 *   RETURNED                          → devolvidos
 *   RETURNING_TO_ORIGIN               → devolvidos
 *
 * RETORNO ESPERADO PELA FIVE:
 *   HTTP 200 sempre que o payload foi recebido (mesmo em erro interno).
 *   Qualquer status != 200 faz a Five reenviar o webhook.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  buildOrderRecord,
  validateFivePayload,
  type ExistingOrderRow,
  type FiveWebhookPayload,
} from "@/lib/five-webhook";
import type { KanbanColumn } from "@/types";

export type FiveWebhookSource = "antecipado" | "agendado";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function fiveWebhookOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function fiveWebhookGet(source: FiveWebhookSource, path: string) {
  return json(200, {
    ok: true,
    service: `dashboard-x1-five-${source}`,
    message: "Webhook ativo. A Five deve enviar esta URL por POST.",
    url: path,
    type: source,
  });
}

export function fiveWebhookHead() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function getSecretFromRequest(req: NextRequest): string {
  return (req.nextUrl.searchParams.get("secret") ?? "").trim();
}

function expectedSecret(source: FiveWebhookSource): string | undefined {
  if (source === "antecipado") {
    return process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim();
  }
  return process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim();
}

async function logWebhook(
  source: FiveWebhookSource,
  orderNumber: string | null,
  payload: FiveWebhookPayload,
  statusMapped: KanbanColumn | null,
  error: string | null
) {
  try {
    await supabase.from("webhook_logs").insert({
      source,
      order_number: orderNumber,
      payload,
      status_mapped: statusMapped,
      error,
    });
  } catch {
    /* tabela pode não existir ainda */
  }
}

async function syncAppointment(
  saved: {
    id: string;
    payment_type: string;
    kanban_status: string;
    customer_name: string;
  }
) {
  if (saved.payment_type !== "agendado" && saved.payment_type !== "payafter") return;

  const status =
    saved.kanban_status === "pagos" ? "compareceu" : "agendado";

  const { data: existingAppt } = await supabase
    .from("appointments")
    .select("id")
    .eq("order_id", saved.id)
    .maybeSingle();

  const apptPayload = {
    order_id: saved.id,
    customer_name: saved.customer_name,
    payment_type: "agendado",
    status,
    scheduled_at: new Date().toISOString(),
  };

  if (existingAppt?.id) {
    await supabase.from("appointments").update(apptPayload).eq("id", existingAppt.id);
  } else {
    await supabase.from("appointments").insert(apptPayload);
  }
}

export async function processFiveWebhookPost(
  req: NextRequest,
  source: FiveWebhookSource,
  options?: { skipSecret?: boolean }
): Promise<NextResponse> {
  const secret = expectedSecret(source);
  const envKey = `FIVE_WEBHOOK_SECRET_${source === "antecipado" ? "ANTECIPADO" : "AGENDADO"}`;
  const isProd = process.env.NODE_ENV === "production";

  if (!options?.skipSecret) {
    if (!secret) {
      if (isProd) {
        return json(401, {
          ok: false,
          error: `Configure ${envKey} nas variáveis de ambiente (Vercel → Settings → Environment Variables).`,
        });
      }
      // Dev: aceita sem secret mas avisa no console
      console.warn(
        `[webhook/five/${source}] AVISO: ${envKey} não configurada — aceitando em modo dev. Em produção a Five deve enviar a URL com ?secret=VALOR.`
      );
    } else {
      const incoming = getSecretFromRequest(req);
      if (incoming !== secret) {
        return json(401, { ok: false, error: "Secret inválido (query param ?secret=)." });
      }
    }
  }

  let payload: unknown;

  try {
    const rawBody = await req.text();
    payload = JSON.parse(rawBody || "{}");
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : "JSON inválido";
    await logWebhook(source, null, {}, null, message);
    return json(400, {
      ok: false,
      error: "Body recebido não é JSON válido.",
      detail: message,
    });
  }

  const validation = validateFivePayload(payload);
  if (!validation.ok) {
    await logWebhook(source, null, (payload as FiveWebhookPayload) ?? {}, null, validation.error);
    return json(400, { ok: false, error: validation.error });
  }

  const data = validation.data;
  const orderNumber = String(
    data.orderId || (data.order as { id?: string } | undefined)?.id || ""
  ).trim();

  try {
    const { data: existing, error: findError } = await supabase
      .from("orders")
      .select(
        "kanban_status, customer_email, customer_phone, tracking_code, paid_at, " +
        "seller_name, customer_doc, address_full, offer_title, shipping_platform, project_name, " +
        "city, state, zip_code, estado"
      )
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (findError) throw findError;

    const record = buildOrderRecord(
      data,
      existing as ExistingOrderRow | null,
      source
    );

    const { data: saved, error: upsertError } = await supabase
      .from("orders")
      .upsert(
        {
          ...record,
          webhook_source: source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_number" }
      )
      .select("id, payment_type, kanban_status, customer_name, order_number")
      .single();

    if (upsertError) throw upsertError;

    await syncAppointment(saved);
    await logWebhook(source, orderNumber, data, record.kanban_status, null);

    return json(200, {
      received: true,
      type: source,
      orderId: orderNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao salvar pedido";
    await logWebhook(source, orderNumber, data, null, message);
    console.error(`[webhook/five/${source}]`, message, err);
    // HTTP 200 mesmo em erro interno: evita que a Five marque como falha e reenvie o webhook.
    return json(200, { received: true, type: source, orderId: orderNumber, warning: message });
  }
}
