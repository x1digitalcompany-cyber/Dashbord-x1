import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { pctChange, prevPeriod, round2, safeDivide } from "@/lib/finance";
import type { AgendamentosExpanded } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(searchParams.get("to") ?? Date.now());
  const sellerIds = searchParams.get("sellerIds")?.split(",").filter(Boolean) ?? [];
  const prev = prevPeriod(from, to);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  try {
    let apptQuery = supabase
      .from("appointments")
      .select("id, payment_type, status, created_at, seller_id")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);

    if (sellerIds.length) apptQuery = apptQuery.in("seller_id", sellerIds);

    const [apptRes, sellersRes] = await Promise.all([
      apptQuery,
      supabase.from("sellers").select("id, name").eq("is_active", true),
    ]);

    let appointments = apptRes.data ?? [];

    if (apptRes.error || !appointments.length) {
      let ordQuery = supabase
        .from("orders")
        .select("id, payment_type, kanban_status, created_at, seller_id, customer_name")
        .in("payment_type", ["payafter", "agendado"])
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      if (sellerIds.length) ordQuery = ordQuery.in("seller_id", sellerIds);
      const { data: orders } = await ordQuery;
      appointments = (orders ?? []).map((o) => ({
        id: o.id,
        payment_type: o.payment_type ?? "payafter",
        status: o.kanban_status === "pagos" ? "compareceu" : "agendado",
        created_at: o.created_at,
        seller_id: o.seller_id,
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

    const sellers = sellersRes.data ?? [];
    const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
    const bySellerMap = new Map<string, number>();
    for (const a of appointments) {
      const sid = a.seller_id ?? "sem-vendedor";
      bySellerMap.set(sid, (bySellerMap.get(sid) ?? 0) + 1);
    }
    const bySeller = Array.from(bySellerMap.entries())
      .map(([sellerId, agendamentos]) => ({
        sellerId,
        sellerName: sellerMap[sellerId] ?? "Sem vendedor",
        agendamentos,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos);

    const prevFromISO = prev.from.toISOString();
    const prevToISO = prev.to.toISOString();
    const { count: prevTotal } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevFromISO)
      .lte("created_at", prevToISO);

    const result: AgendamentosExpanded = {
      total,
      antecipado,
      payafter: agendadoCount,
      taxaComparecimento: round2(safeDivide(compareceu, total) * 100),
      variationPct: pctChange(total, prevTotal ?? 0),
      daily,
      bySeller,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar agendamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
