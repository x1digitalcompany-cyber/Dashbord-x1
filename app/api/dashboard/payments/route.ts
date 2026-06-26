import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import type { PaymentRow, PaymentStatus, PagamentosExpanded, PaymentSourceBreakdown } from "@/types";

const ALL_KANBAN = ["pedidos_criados", "em_transito", "retirar_correios", "pagos", "devolvidos", "inadimplentes", "entregue"];

const PAYT_APPROVED = ["approved", "paid", "complete", "completed"];
const PAYT_PENDING = ["pending", "waiting", "processing"];
const PAYT_REFUNDED = ["refunded", "cancelled", "canceled", "chargeback"];

function emptyBreakdown(): PaymentSourceBreakdown {
  return {
    aprovados: { count: 0, valor: 0 },
    pendentes: { count: 0, valor: 0 },
    reembolsos: { count: 0, valor: 0 },
  };
}

function kanbanToPaymentStatus(ks: string): PaymentStatus {
  if (ks === "pagos") return "approved";
  if (ks === "devolvidos") return "refunded";
  if (ks === "inadimplentes") return "chargeback";
  return "pending";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const expanded = searchParams.get("expanded") === "1";
  const sellerName = parseSellerParam(searchParams);

  try {
    let ordersQuery = supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, value, gateway, kanban_status, created_at, seller_name, payment_type"
      )
      .in("kanban_status", ALL_KANBAN)
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });
    if (sellerName) ordersQuery = ordersQuery.eq("seller_name", sellerName);

    const paytQuery = supabase
      .from("payt_payments")
      .select("id, transaction_id, customer_name, amount, status, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });

    const braipQuery = supabase
      .from("braip_payments")
      .select("id, transaction_id, customer_name, amount, status, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });

    const [ordersRes, paytRes, braipRes] = await Promise.all([
      ordersQuery,
      paytQuery,
      braipQuery,
    ]);

    if (ordersRes.error) throw ordersRes.error;

    const orders = ordersRes.data ?? [];
    const paytPayments = paytRes.data ?? [];
    const braipPayments = braipRes.data ?? [];

    const map: Record<string, { volume: number; count: number }> = {};

    for (const o of orders) {
      const gateway = o.gateway === "five" ? "five" : o.gateway;
      const status = kanbanToPaymentStatus(o.kanban_status);
      const key = `${gateway}::${status}`;
      if (!map[key]) map[key] = { volume: 0, count: 0 };
      map[key].volume += Number(o.value) || 0;
      map[key].count += 1;
    }

    for (const p of paytPayments) {
      const status = PAYT_APPROVED.includes(p.status)
        ? "approved"
        : PAYT_REFUNDED.includes(p.status)
          ? "refunded"
          : "pending";
      const key = `payt::${status}`;
      if (!map[key]) map[key] = { volume: 0, count: 0 };
      map[key].volume += Number(p.amount) || 0;
      map[key].count += 1;
    }

    for (const p of braipPayments) {
      const status = PAYT_APPROVED.includes(p.status)
        ? "approved"
        : PAYT_REFUNDED.includes(p.status)
          ? "refunded"
          : "pending";
      const key = `braip::${status}`;
      if (!map[key]) map[key] = { volume: 0, count: 0 };
      map[key].volume += Number(p.amount) || 0;
      map[key].count += 1;
    }

    const rows: PaymentRow[] = Object.entries(map).map(([key, data]) => {
      const [gateway, status] = key.split("::");
      return {
        gateway: gateway as PaymentRow["gateway"],
        status: status as PaymentStatus,
        ...data,
      };
    });

    if (!expanded) {
      return NextResponse.json(rows);
    }

    const five = emptyBreakdown();
    for (const o of orders) {
      const val = Number(o.value) || 0;
      if (o.kanban_status === "pagos") {
        five.aprovados.count += 1;
        five.aprovados.valor += val;
      } else if (o.kanban_status === "entregue") {
        five.pendentes.count += 1;
        five.pendentes.valor += val;
      } else if (o.kanban_status === "devolvidos") {
        five.reembolsos!.count += 1;
        five.reembolsos!.valor += val;
      }
    }

    const payt = emptyBreakdown();
    for (const p of paytPayments) {
      const val = Number(p.amount) || 0;
      if (PAYT_APPROVED.includes(p.status)) {
        payt.aprovados.count += 1;
        payt.aprovados.valor += val;
      } else if (PAYT_PENDING.includes(p.status)) {
        payt.pendentes.count += 1;
        payt.pendentes.valor += val;
      } else if (PAYT_REFUNDED.includes(p.status)) {
        payt.reembolsos!.count += 1;
        payt.reembolsos!.valor += val;
      }
    }

    const braip = emptyBreakdown();
    for (const p of braipPayments) {
      const val = Number(p.amount) || 0;
      if (PAYT_APPROVED.includes(p.status)) {
        braip.aprovados.count += 1;
        braip.aprovados.valor += val;
      } else if (PAYT_PENDING.includes(p.status)) {
        braip.pendentes.count += 1;
        braip.pendentes.valor += val;
      } else if (PAYT_REFUNDED.includes(p.status)) {
        braip.reembolsos!.count += 1;
        braip.reembolsos!.valor += val;
      }
    }

    const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);

    const byGateway = ["pagarme", "payt", "five", "braip"].map((gw) => {
      const gwRows = rows.filter((r) => r.gateway === gw);
      return {
        gateway: gw as PaymentRow["gateway"],
        volume: gwRows.reduce((s, r) => s + r.volume, 0),
        count: gwRows.reduce((s, r) => s + r.count, 0),
      };
    });

    const recentOrders = orders.slice(0, 15).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      value: Number(o.value),
      gateway: o.gateway as PaymentRow["gateway"],
      status: kanbanToPaymentStatus(o.kanban_status),
      createdAt: o.created_at,
    }));

    const recentPayt = paytPayments.slice(0, 5).map((p) => ({
      id: p.id,
      orderNumber: p.transaction_id,
      customerName: p.customer_name ?? "—",
      value: Number(p.amount),
      gateway: "payt" as const,
      status: (PAYT_APPROVED.includes(p.status)
        ? "approved"
        : PAYT_REFUNDED.includes(p.status)
          ? "refunded"
          : "pending") as PaymentStatus,
      createdAt: p.created_at,
    }));

    const recentBraip = braipPayments.slice(0, 5).map((p) => ({
      id: p.id,
      orderNumber: p.transaction_id,
      customerName: p.customer_name ?? "—",
      value: Number(p.amount),
      gateway: "braip" as const,
      status: (PAYT_APPROVED.includes(p.status)
        ? "approved"
        : PAYT_REFUNDED.includes(p.status)
          ? "refunded"
          : "pending") as PaymentStatus,
      createdAt: p.created_at,
    }));

    const recent = [...recentOrders, ...recentPayt, ...recentBraip]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);

    const result: PagamentosExpanded = {
      rows,
      totalVolume,
      totalCount,
      byGateway,
      sources: {
        five,
        payt,
        braip,
        total: { valor: totalVolume, transacoes: totalCount },
      },
      recent,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pagamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
