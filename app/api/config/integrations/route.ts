import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import {
  buildWebhookUrl,
  getWebhookId,
  getWebhookSecret,
  maskSecretKey,
} from "@/lib/webhook-config";
import { supabase } from "@/lib/supabase";
import { formatDatetime } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const secret = await getWebhookSecret();
  const webhookId = await getWebhookId();

  const [antecipadoLog, agendadoLog, paytLast, braipLast, x1companyLast] = await Promise.all([
    supabase
      .from("webhook_logs")
      .select("order_number, created_at, error")
      .eq("source", "antecipado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("webhook_logs")
      .select("order_number, created_at, error")
      .eq("source", "agendado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("payt_payments")
      .select("transaction_id, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("braip_payments")
      .select("transaction_id, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("x1company_payments")
      .select("transaction_id, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const url = (path: string) =>
    webhookId ? buildWebhookUrl(base, path, webhookId) : `${base}${path}`;

  return NextResponse.json({
    secretConfigured: Boolean(secret),
    secretMasked: secret ? maskSecretKey(secret) : null,
    webhookId,
    fiveAntecipado: {
      url: url("/api/webhooks/five/antecipado"),
      active: Boolean(webhookId),
      lastReceived: antecipadoLog.data
        ? {
            id: antecipadoLog.data.order_number,
            at: antecipadoLog.data.created_at,
            atFormatted: formatDatetime(antecipadoLog.data.created_at),
            error: antecipadoLog.data.error,
          }
        : null,
    },
    fiveAgendado: {
      url: url("/api/webhooks/five/agendado"),
      active: Boolean(webhookId),
      lastReceived: agendadoLog.data
        ? {
            id: agendadoLog.data.order_number,
            at: agendadoLog.data.created_at,
            atFormatted: formatDatetime(agendadoLog.data.created_at),
            error: agendadoLog.data.error,
          }
        : null,
    },
    payt: {
      url: url("/api/webhooks/payt"),
      active: Boolean(webhookId),
      lastReceived: paytLast.data
        ? {
            id: paytLast.data.transaction_id,
            at: paytLast.data.created_at,
            atFormatted: formatDatetime(paytLast.data.created_at),
            status: paytLast.data.status,
          }
        : null,
    },
    braip: {
      url: url("/api/webhooks/braip"),
      active: Boolean(webhookId),
      lastReceived: braipLast.data
        ? {
            id: braipLast.data.transaction_id,
            at: braipLast.data.created_at,
            atFormatted: formatDatetime(braipLast.data.created_at),
            status: braipLast.data.status,
          }
        : null,
    },
    x1company: {
      url: url("/api/webhooks/x1company"),
      active: Boolean(webhookId),
      lastReceived: x1companyLast.data
        ? {
            id: x1companyLast.data.transaction_id,
            at: x1companyLast.data.created_at,
            atFormatted: formatDatetime(x1companyLast.data.created_at),
            status: x1companyLast.data.status,
          }
        : null,
    },
  });
}
