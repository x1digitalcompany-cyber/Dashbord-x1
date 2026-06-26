import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateWebhookSecret } from "@/lib/webhook-config";
import { parseBraipPayment } from "@/lib/payment-parsers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return json(200, { ok: true, service: "dashboard-x1-braip", message: "Webhook Braip ativo. Envie POST com JSON." });
}

export async function POST(req: NextRequest) {
  try {
    const incoming = (req.nextUrl.searchParams.get("secret") ?? "").trim();
    if (!incoming || !(await validateWebhookSecret(incoming))) {
      return json(401, { error: "Secret inválido" });
    }

    const rawBody = (await req.json()) as Record<string, unknown>;
    const typePostback = rawBody.type as string | undefined;

    if (typePostback && typePostback !== "TRACKING_STATUS_CHANGED") {
      return json(200, { received: true, ignored: true, reason: "unsupported_type" });
    }

    const parsed = parseBraipPayment(rawBody);

    if (!parsed.transaction_id) {
      console.warn("[webhook/braip] sem transaction_id — ignorado");
      return json(200, { received: true, ignored: "no_transaction_id" });
    }

    const now = new Date().toISOString();
    const payload = {
      transaction_id: parsed.transaction_id,
      customer_name: parsed.customer_name,
      customer_email: parsed.customer_email,
      customer_phone: parsed.customer_phone,
      customer_doc: parsed.customer_doc,
      amount: parsed.amount,
      status: parsed.status ?? "unknown",
      payment_method: parsed.payment_method,
      product_name: parsed.product_name,
      payload: rawBody,
      updated_at: now,
    };

    if (parsed.status === "refunded" || parsed.status === "pending") {
      await supabase
        .from("braip_payments")
        .upsert(payload, { onConflict: "transaction_id" });
      return json(200, { received: true, status_only: parsed.status });
    }

    if (parsed.status !== "approved") {
      console.warn(
        `[webhook/braip] status não reconhecido tx=${parsed.transaction_id} status=${parsed.status}`
      );
      return json(200, { received: true, ignored: "unknown_status" });
    }

    await supabase.from("braip_payments").upsert(
      { ...payload, status: "approved" },
      { onConflict: "transaction_id" }
    );

    return json(200, { received: true });
  } catch (err) {
    console.error("[webhook/braip]", err);
    return json(200, { received: true, warning: "internal_error" });
  }
}
