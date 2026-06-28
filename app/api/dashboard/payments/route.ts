import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import type {
  PaymentRow,
  PagamentosExpanded,
  PagarmePaymentStats,
  PaytBraipPaymentStats,
} from "@/types";

const PAYT_APPROVED = ["approved", "paid", "complete", "completed"];
const PAYT_PENDING = ["pending", "waiting", "processing"];
const PAYT_REFUNDED = ["refunded", "cancelled", "canceled", "chargeback"];

function emptyPagarme(): PagarmePaymentStats {
  return {
    aprovados_valor: 0,
    aprovados_count: 0,
    pendentes_valor: 0,
    pendentes_count: 0,
    estornos_valor: 0,
    estornos_count: 0,
  };
}

function emptyPaytBraip(): PaytBraipPaymentStats {
  return {
    aprovados_valor: 0,
    aprovados_count: 0,
    pendentes_valor: 0,
    pendentes_count: 0,
    reembolsos_valor: 0,
    reembolsos_count: 0,
  };
}

function statsToRows(
  pagarme: PagarmePaymentStats,
  payt: PaytBraipPaymentStats,
  braip: PaytBraipPaymentStats
): PaymentRow[] {
  const rows: PaymentRow[] = [
    { gateway: "pagarme", status: "approved", volume: pagarme.aprovados_valor, count: pagarme.aprovados_count },
    { gateway: "pagarme", status: "pending", volume: pagarme.pendentes_valor, count: pagarme.pendentes_count },
    { gateway: "pagarme", status: "refunded", volume: pagarme.estornos_valor, count: pagarme.estornos_count },
    { gateway: "payt", status: "approved", volume: payt.aprovados_valor, count: payt.aprovados_count },
    { gateway: "payt", status: "pending", volume: payt.pendentes_valor, count: payt.pendentes_count },
    { gateway: "payt", status: "refunded", volume: payt.reembolsos_valor, count: payt.reembolsos_count },
    { gateway: "braip", status: "approved", volume: braip.aprovados_valor, count: braip.aprovados_count },
    { gateway: "braip", status: "pending", volume: braip.pendentes_valor, count: braip.pendentes_count },
    { gateway: "braip", status: "refunded", volume: braip.reembolsos_valor, count: braip.reembolsos_count },
  ];
  return rows.filter((r) => r.count > 0 || r.volume > 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const expanded = searchParams.get("expanded") === "1";
  const sellerName = parseSellerParam(searchParams);

  try {
    let pagarmeQuery = supabase
      .from("orders")
      .select("value, kanban_status")
      .eq("gateway", "pagarme")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());
    if (sellerName) pagarmeQuery = pagarmeQuery.eq("seller_name", sellerName);

    const paytQuery = supabase
      .from("payt_payments")
      .select("amount, status")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    const braipQuery = supabase
      .from("braip_payments")
      .select("amount, status")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    const [pagarmeRes, paytRes, braipRes] = await Promise.all([
      pagarmeQuery,
      paytQuery,
      braipQuery,
    ]);

    if (pagarmeRes.error) throw pagarmeRes.error;

    const pagarme = emptyPagarme();
    for (const o of pagarmeRes.data ?? []) {
      const val = Number(o.value) || 0;
      if (o.kanban_status === "pagos") {
        pagarme.aprovados_count += 1;
        pagarme.aprovados_valor += val;
      } else if (o.kanban_status === "devolvidos" || o.kanban_status === "inadimplentes") {
        pagarme.estornos_count += 1;
        pagarme.estornos_valor += val;
      } else {
        pagarme.pendentes_count += 1;
        pagarme.pendentes_valor += val;
      }
    }

    const payt = emptyPaytBraip();
    for (const p of paytRes.data ?? []) {
      const val = Number(p.amount) || 0;
      if (PAYT_APPROVED.includes(p.status)) {
        payt.aprovados_count += 1;
        payt.aprovados_valor += val;
      } else if (PAYT_PENDING.includes(p.status)) {
        payt.pendentes_count += 1;
        payt.pendentes_valor += val;
      } else if (PAYT_REFUNDED.includes(p.status)) {
        payt.reembolsos_count += 1;
        payt.reembolsos_valor += val;
      }
    }

    const braip = emptyPaytBraip();
    for (const p of braipRes.data ?? []) {
      const val = Number(p.amount) || 0;
      if (PAYT_APPROVED.includes(p.status)) {
        braip.aprovados_count += 1;
        braip.aprovados_valor += val;
      } else if (PAYT_PENDING.includes(p.status)) {
        braip.pendentes_count += 1;
        braip.pendentes_valor += val;
      } else if (PAYT_REFUNDED.includes(p.status)) {
        braip.reembolsos_count += 1;
        braip.reembolsos_valor += val;
      }
    }

    const gatewayTotal = (g: PagarmePaymentStats | PaytBraipPaymentStats, isPagarme: boolean) => {
      const estornos = isPagarme
        ? (g as PagarmePaymentStats).estornos_valor
        : (g as PaytBraipPaymentStats).reembolsos_valor;
      const estornosCount = isPagarme
        ? (g as PagarmePaymentStats).estornos_count
        : (g as PaytBraipPaymentStats).reembolsos_count;
      return {
        valor: g.aprovados_valor + g.pendentes_valor + estornos,
        count: g.aprovados_count + g.pendentes_count + estornosCount,
      };
    };

    const pagarmeTot = gatewayTotal(pagarme, true);
    const paytTot = gatewayTotal(payt, false);
    const braipTot = gatewayTotal(braip, false);

    const total = {
      valor: pagarmeTot.valor + paytTot.valor + braipTot.valor,
      transacoes: pagarmeTot.count + paytTot.count + braipTot.count,
    };

    if (!expanded) {
      const rows = statsToRows(pagarme, payt, braip);
      return NextResponse.json(rows);
    }

    const result: PagamentosExpanded = { pagarme, payt, braip, total };
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pagamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
