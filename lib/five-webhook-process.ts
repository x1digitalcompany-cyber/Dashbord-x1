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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Five-Secret",
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
  return (
    req.headers.get("x-five-secret") ||
    req.headers.get("X-Five-Secret") ||
    ""
  ).trim();
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

  if (!options?.skipSecret) {
    if (!secret) {
      return json(401, {
        ok: false,
        error: `Configure FIVE_WEBHOOK_SECRET_${source === "antecipado" ? "ANTECIPADO" : "AGENDADO"} no .env.local.`,
      });
    }
    const incoming = getSecretFromRequest(req);
    if (incoming !== secret) {
      return json(401, { ok: false, error: "Secret inválido (header X-Five-Secret)." });
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
      .select("kanban_status, customer_email, customer_phone, tracking_code, paid_at")
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
    return json(500, { ok: false, error: message });
  }
}
