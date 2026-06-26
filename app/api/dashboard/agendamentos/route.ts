import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { pctChange, prevPeriod, round2, safeDivide } from "@/lib/finance";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import type { AgendamentosExpanded } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const sellerName = parseSellerParam(searchParams);
  const prev = prevPeriod(from, to);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  try {
    let appointments: Array<{
      id: string;
      payment_type: string;
      status: string;
      created_at: string;
      seller_id: string | null;
      seller_name?: string | null;
    }> = [];

    if (!sellerName) {
      const apptRes = await supabase
        .from("appointments")
        .select("id, payment_type, status, created_at, seller_id")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);

      appointments = apptRes.data ?? [];
    }

    if (sellerName || !appointments.length) {
      let ordersQ = supabase
        .from("orders")
        .select(
          "id, payment_type, kanban_status, created_at, seller_id, seller_name, customer_name"
        )
        .neq("customer_email", "cliente@example.com")
        .not("customer_name", "ilike", "%cliente fict%")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      if (sellerName) ordersQ = ordersQ.eq("seller_name", sellerName);

      const { data: orders } = await ordersQ;

      appointments = (orders ?? []).map((o: {
        id: string;
        payment_type: string | null;
        kanban_status: string;
        created_at: string;
        seller_id: string | null;
        seller_name: string | null;
      }) => ({
        id: o.id,
        payment_type: o.payment_type ?? "payafter",
        status: o.kanban_status === "pagos" ? "compareceu" : "agendado",
        created_at: o.created_at,
        seller_id: o.seller_id,
        seller_name: o.seller_name,
      }));
    }

    const antecipado = appointments.filter((a) => a.payment_type === "antecipado").length;
    const agendadoCount = appointments.filter(
      (a) => a.payment_type === "agendado" || a.payment_type === "payafter"
    ).length;
    const compareceu = appointments.filter((a) => a.status === "compareceu").length;
    const total = appointments.length;

    const byDay = new Map<string, number>();
    for (const a of appointments) {
      const day = a.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const daily = Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bySellerMap = new Map<string, number>();
    for (const a of appointments) {
      const key = a.seller_name ?? a.seller_id ?? "sem-vendedor";
      bySellerMap.set(key, (bySellerMap.get(key) ?? 0) + 1);
    }
    const bySeller = Array.from(bySellerMap.entries())
      .map(([key, agendamentos]) => ({
        sellerId: key,
        sellerName: key === "sem-vendedor" ? "Sem vendedor" : key,
        agendamentos,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos);

    const prevFromISO = prev.from.toISOString();
    const prevToISO = prev.to.toISOString();

    let prevTotal = 0;
    if (sellerName) {
      let prevQ = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("customer_email", "cliente@example.com")
        .not("customer_name", "ilike", "%cliente fict%")
        .gte("created_at", prevFromISO)
        .lte("created_at", prevToISO)
        .eq("seller_name", sellerName);
      const { count } = await prevQ;
      prevTotal = count ?? 0;
    } else {
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", prevFromISO)
        .lte("created_at", prevToISO);
      prevTotal = count ?? 0;
    }

    const result: AgendamentosExpanded = {
      total,
      antecipado,
      payafter: agendadoCount,
      taxaComparecimento: round2(safeDivide(compareceu, total) * 100),
      variationPct: pctChange(total, prevTotal),
      daily,
      bySeller,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar agendamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
