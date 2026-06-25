import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { PaymentRow, PaymentStatus, PagamentosExpanded } from "@/types";

const ALL_KANBAN = ["chegou", "retirar_correios", "pagos", "devolvidos", "inadimplentes"];

function kanbanToPaymentStatus(ks: string): PaymentStatus {
  if (ks === "pagos") return "approved";
  if (ks === "devolvidos") return "refunded";
  if (ks === "inadimplentes") return "chargeback";
  return "pending";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(searchParams.get("to") ?? Date.now());
  const expanded = searchParams.get("expanded") === "1";

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, value, gateway, kanban_status, created_at"
      )
      .in("kanban_status", ALL_KANBAN)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const map: Record<string, { volume: number; count: number }> = {};

    for (const o of orders ?? []) {
      const gateway = o.gateway === "five" ? "five" : o.gateway;
      const status = kanbanToPaymentStatus(o.kanban_status);
      const key = `${gateway}::${status}`;
      if (!map[key]) map[key] = { volume: 0, count: 0 };
      map[key].volume += Number(o.value) || 0;
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

    const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);

    const byGateway = ["pagarme", "payt", "five"].map((gw) => {
      const gwRows = rows.filter((r) => r.gateway === gw);
      return {
        gateway: gw as PaymentRow["gateway"],
        volume: gwRows.reduce((s, r) => s + r.volume, 0),
        count: gwRows.reduce((s, r) => s + r.count, 0),
      };
    });

    const recent = (orders ?? []).slice(0, 20).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      value: Number(o.value),
      gateway: o.gateway as PaymentRow["gateway"],
      status: kanbanToPaymentStatus(o.kanban_status),
      createdAt: o.created_at,
    }));

    const result: PagamentosExpanded = {
      rows,
      totalVolume,
      totalCount,
      byGateway,
      recent,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pagamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
