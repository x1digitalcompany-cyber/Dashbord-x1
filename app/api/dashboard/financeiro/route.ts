import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";
import { pctChange, prevPeriod, round2, safeDivide, REVENUE_STATUSES, SALE_STATUS } from "@/lib/finance";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import type { FinanceiroData } from "@/types";

interface OrderRow {
  value: number;
  kanban_status: string;
  payment_type: string | null;
  created_at: string;
}

function sumOrders(
  orders: OrderRow[],
  filter: (o: OrderRow) => boolean
): number {
  return orders.filter(filter).reduce((s, o) => s + Number(o.value), 0);
}

function countOrders(orders: OrderRow[], filter: (o: OrderRow) => boolean): number {
  return orders.filter(filter).length;
}

function groupByDay(orders: OrderRow[], filter: (o: OrderRow) => boolean) {
  const map = new Map<string, { revenue: number; sales: number }>();
  for (const o of orders) {
    if (!filter(o)) continue;
    const day = o.created_at.slice(0, 10);
    const cur = map.get(day) ?? { revenue: 0, sales: 0 };
    cur.revenue += Number(o.value);
    if (o.kanban_status === SALE_STATUS) cur.sales += 1;
    map.set(day, cur);
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, revenue: round2(v.revenue), sales: v.sales }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function countAppointments(fromISO: string, toISO: string): Promise<number> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (error) {
    const { count: fallback } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
        .in("payment_type", ["payafter", "agendado"])
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    return fallback ?? 0;
  }
  return count ?? 0;
}

function buildMetrics(
  orders: OrderRow[],
  adSpend: number,
  leadsAtendidos: number
) {
  const faturamento = sumOrders(orders, (o) =>
    REVENUE_STATUSES.includes(o.kanban_status as typeof REVENUE_STATUSES[number])
  );
  const totalVendas = countOrders(orders, (o) => o.kanban_status === SALE_STATUS);
  const inadimplencia = sumOrders(orders, (o) => o.kanban_status === "inadimplentes");
  const lucro = faturamento - adSpend;

  const antecipado = {
    faturamento: sumOrders(orders, (o) =>
      REVENUE_STATUSES.includes(o.kanban_status as typeof REVENUE_STATUSES[number]) &&
      o.payment_type === "antecipado"
    ),
    vendas: countOrders(
      orders,
      (o) => o.kanban_status === SALE_STATUS && o.payment_type === "antecipado"
    ),
  };
  const payafter = {
    faturamento: sumOrders(orders, (o) =>
      REVENUE_STATUSES.includes(o.kanban_status as typeof REVENUE_STATUSES[number]) &&
      (o.payment_type === "payafter" || o.payment_type === "agendado")
    ),
    vendas: countOrders(
      orders,
      (o) =>
        o.kanban_status === SALE_STATUS &&
        (o.payment_type === "payafter" || o.payment_type === "agendado")
    ),
  };

  const agendado = payafter;

  return {
    faturamentoTotal: round2(faturamento),
    gastoAnuncios: round2(adSpend),
    lucroLiquido: round2(lucro),
    roas: round2(safeDivide(faturamento, adSpend)),
    totalVendas,
    ticketMedio: round2(safeDivide(faturamento, totalVendas)),
    leadsAtendidos,
    leadsPorVenda: round2(safeDivide(totalVendas, leadsAtendidos)),
    taxaConversao: round2(safeDivide(totalVendas, leadsAtendidos) * 100),
    cpaMedio: round2(safeDivide(adSpend, totalVendas)),
    inadimplenciaTotal: round2(inadimplencia),
    taxaInadimplencia: round2(safeDivide(inadimplencia, faturamento) * 100),
    porTipo: { antecipado, payafter, agendado },
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const prev = prevPeriod(from, to);
  const sellerName = parseSellerParam(searchParams);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const prevFromISO = prev.from.toISOString();
  const prevToISO = prev.to.toISOString();

  try {
    let ordersQ = supabase
      .from("orders")
      .select("value, kanban_status, payment_type, created_at")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    if (sellerName) ordersQ = ordersQ.eq("seller_name", sellerName);

    let prevOrdersQ = supabase
      .from("orders")
      .select("value, kanban_status, payment_type, created_at")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", prevFromISO)
      .lte("created_at", prevToISO);
    if (sellerName) prevOrdersQ = prevOrdersQ.eq("seller_name", sellerName);

    const [ordersRes, prevOrdersRes, metaCurr, metaPrev, leadsCurr, leadsPrev] =
      await Promise.all([
        ordersQ,
        prevOrdersQ,
        fetchMetaAdsInsights(from, to).catch((e: Error) => ({
          spend: 0,
          daily: [],
          error: e.message,
          impressions: 0,
          clicks: 0,
          cpm: 0,
          cpc: 0,
          campaigns: [],
          currency: "BRL" as const,
          source: "meta_api" as const,
        })),
        fetchMetaAdsInsights(prev.from, prev.to).catch(() => ({
          spend: 0,
          daily: [],
          impressions: 0,
          clicks: 0,
          cpm: 0,
          cpc: 0,
          campaigns: [],
          currency: "BRL" as const,
          source: "meta_api" as const,
        })),
        countAppointments(fromISO, toISO),
        countAppointments(prevFromISO, prevToISO),
      ]);

    if (ordersRes.error) throw ordersRes.error;
    if (prevOrdersRes.error) throw prevOrdersRes.error;

    const orders = (ordersRes.data ?? []) as OrderRow[];
    const prevOrders = (prevOrdersRes.data ?? []) as OrderRow[];

    const curr = buildMetrics(orders, metaCurr.spend, leadsCurr);
    const previous = buildMetrics(prevOrders, metaPrev.spend, leadsPrev);

    const revenueByDay = groupByDay(orders, (o) =>
      REVENUE_STATUSES.includes(o.kanban_status as typeof REVENUE_STATUSES[number])
    );
    const salesByDay = groupByDay(orders, (o) => o.kanban_status === SALE_STATUS);

    const adSpendByDay = metaCurr.daily.map((d) => ({
      date: d.date,
      spend: round2(d.spend),
    }));

    const timeline = mergeTimeline(revenueByDay, adSpendByDay, salesByDay);

    const result: FinanceiroData = {
      current: curr,
      previous,
      variations: {
        faturamentoTotal: pctChange(curr.faturamentoTotal, previous.faturamentoTotal),
        gastoAnuncios: pctChange(curr.gastoAnuncios, previous.gastoAnuncios),
        lucroLiquido: pctChange(curr.lucroLiquido, previous.lucroLiquido),
        roas: pctChange(curr.roas, previous.roas),
        totalVendas: pctChange(curr.totalVendas, previous.totalVendas),
        ticketMedio: pctChange(curr.ticketMedio, previous.ticketMedio),
        leadsAtendidos: pctChange(curr.leadsAtendidos, previous.leadsAtendidos),
        taxaConversao: pctChange(curr.taxaConversao, previous.taxaConversao),
        cpaMedio: pctChange(curr.cpaMedio, previous.cpaMedio),
        inadimplenciaTotal: pctChange(curr.inadimplenciaTotal, previous.inadimplenciaTotal),
        taxaInadimplencia: pctChange(curr.taxaInadimplencia, previous.taxaInadimplencia),
      },
      timeline,
      metaAdsError: "error" in metaCurr ? metaCurr.error : undefined,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao calcular financeiro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mergeTimeline(
  revenue: { date: string; revenue: number }[],
  adSpend: { date: string; spend: number }[],
  sales: { date: string; sales: number }[]
) {
  const dates = new Set([
    ...revenue.map((r) => r.date),
    ...adSpend.map((a) => a.date),
    ...sales.map((s) => s.date),
  ]);
  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      faturamento: revenue.find((r) => r.date === date)?.revenue ?? 0,
      gastoAnuncios: adSpend.find((a) => a.date === date)?.spend ?? 0,
      vendas: sales.find((s) => s.date === date)?.sales ?? 0,
    }));
}
