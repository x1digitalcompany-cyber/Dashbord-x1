import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { processFiveWebhookPost } from "@/lib/five-webhook-process";
import type { FiveWebhookSource } from "@/lib/five-webhook-process";

const TEST_PAYLOAD = {
  orderId: "TEST-WEBHOOK-DASHBOARD",
  event: "ORDER_CREATE",
  customer: {
    name: "Cliente Teste Dashboard",
    mail: "pago@gmail.com",
    phoneNumber: "11999990000",
    address: { state: "SP", city: "Sao Paulo", zipCode: "01001000" },
  },
  product: { name: "Produto Teste", offer: { price: "99.90" } },
  shipping: { shippingStatus: "SENDED", shippingCode: "BR000000000BR" },
};

async function lastLog(source: FiveWebhookSource) {
  const { data } = await supabase
    .from("webhook_logs")
    .select("order_number, created_at, error")
    .eq("source", source)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const antecipadoSecret = process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO?.trim() ?? "";
  const agendadoSecret = process.env.FIVE_WEBHOOK_SECRET_AGENDADO?.trim() ?? "";

  const [antecipadoLog, agendadoLog] = await Promise.all([
    lastLog("antecipado"),
    lastLog("agendado"),
  ]);

  return NextResponse.json({
    antecipado: {
      url: `${base}/api/webhooks/five/antecipado${antecipadoSecret ? `?secret=${antecipadoSecret}` : ""}`,
      secretConfigured: Boolean(antecipadoSecret),
      lastReceived: antecipadoLog
        ? {
            orderNumber: antecipadoLog.order_number,
            at: antecipadoLog.created_at,
            error: antecipadoLog.error,
          }
        : null,
    },
    agendado: {
      url: `${base}/api/webhooks/five/agendado${agendadoSecret ? `?secret=${agendadoSecret}` : ""}`,
      secretConfigured: Boolean(agendadoSecret),
      lastReceived: agendadoLog
        ? {
            orderNumber: agendadoLog.order_number,
            at: agendadoLog.created_at,
            error: agendadoLog.error,
          }
        : null,
    },
    legacyUrl: `${base}/api/webhooks/five`,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const source = body.source as FiveWebhookSource;
  if (source !== "antecipado" && source !== "agendado") {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }

  const secret = (
    source === "antecipado"
      ? process.env.FIVE_WEBHOOK_SECRET_ANTECIPADO
      : process.env.FIVE_WEBHOOK_SECRET_AGENDADO
  )?.trim() ?? "";

  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const webhookPath =
    source === "antecipado"
      ? "/api/webhooks/five/antecipado"
      : "/api/webhooks/five/agendado";
  const webhookUrl = new URL(`${base}${webhookPath}`);
  if (secret) webhookUrl.searchParams.set("secret", secret);

  const testReq = new NextRequest(webhookUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...TEST_PAYLOAD,
      orderId: `TEST-${source.toUpperCase()}-${Date.now()}`,
    }),
  });

  const res = await processFiveWebhookPost(testReq, source);
  const data = await res.json();
  return NextResponse.json({
    status: res.status,
    response: data,
  });
}
