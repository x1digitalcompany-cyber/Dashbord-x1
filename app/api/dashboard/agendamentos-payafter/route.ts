import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import {
  PAYAFTER_TYPES,
  buildFunnel,
  buildSellersExpanded,
  buildWeeklyPaymentRate,
  computeKpis,
  countRows,
  daysSince,
  pct,
  prevPeriod,
  sumValue,
  type PayafterOrderRow,
} from "@/lib/payafter";
import { round2, safeDivide } from "@/lib/finance";
import type {
  PayafterAlert,
  PayafterDashboardData,
  PayafterInadimplenteRow,
} from "@/types";

async function fetchPayafterOrders(
  fromISO: string,
  toISO: string,
  sellerName: string | null,
  dateField: "created_at" | "updated_at" = "created_at"
): Promise<PayafterOrderRow[]> {
  let q = supabase
    .from("orders")
    .select(
      "id, order_number, display_id, customer_name, customer_phone, customer_cpf, value, kanban_status, payment_type, seller_name, state, created_at, updated_at"
    )
    .in("payment_type", PAYAFTER_TYPES)
    .neq("customer_email", "cliente@example.com")
    .not("customer_name", "ilike", "%cliente fict%")
    .gte(dateField, fromISO)
    .lte(dateField, toISO);

  if (sellerName) q = q.eq("seller_name", sellerName);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((o) => ({
    ...o,
    value: Number(o.value),
  })) as PayafterOrderRow[];
}

async function fetchOperationalOrders(sellerName: string | null): Promise<PayafterOrderRow[]> {
  let q = supabase
    .from("orders")
    .select(
      "id, order_number, display_id, customer_name, customer_phone, customer_cpf, value, kanban_status, payment_type, seller_name, state, created_at, updated_at"
    )
    .in("payment_type", PAYAFTER_TYPES)
    .neq("customer_email", "cliente@example.com")
    .not("customer_name", "ilike", "%cliente fict%");

  if (sellerName) q = q.eq("seller_name", sellerName);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((o) => ({ ...o, value: Number(o.value) })) as PayafterOrderRow[];
}

function buildAlerts(
  allOrders: PayafterOrderRow[],
  last30Orders: PayafterOrderRow[]
): PayafterAlert[] {
  const alerts: PayafterAlert[] = [];

  const entreguesSemPagamento = allOrders.filter((o) => o.kanban_status === "entregue");
  const over15 = entreguesSemPagamento.filter((o) => daysSince(o.updated_at) > 15);
  const over7 = entreguesSemPagamento.filter(
    (o) => daysSince(o.updated_at) > 7 && daysSince(o.updated_at) <= 15
  );

  if (over15.length > 0) {
    alerts.push({
      id: "entregue-15d",
      severity: "red",
      message: `${over15.length} pedidos entregues há mais de 15 dias sem pagamento — ${formatBrl(sumValue(over15, () => true))} em risco`,
      target: "em-risco",
      filter: "15d",
      orderIds: over15.map((o) => o.id),
    });
  }
  if (over7.length > 0) {
    alerts.push({
      id: "entregue-7d",
      severity: "yellow",
      message: `${over7.length} pedidos entregues há mais de 7 dias sem pagamento — ${formatBrl(sumValue(over7, () => true))} em risco`,
      target: "em-risco",
      filter: "7d",
      orderIds: over7.map((o) => o.id),
    });
  }

  const faturamento30 = sumValue(last30Orders, (o) =>
    ["pagos", "inadimplentes"].includes(o.kanban_status)
  );
  const inadimplencia30 = sumValue(last30Orders, (o) => o.kanban_status === "inadimplentes");
  const taxaInad = round2(safeDivide(inadimplencia30, faturamento30) * 100);
  if (taxaInad > 20) {
    alerts.push({
      id: "inadimplencia-30d",
      severity: "red",
      message: `Taxa de inadimplência acima de 20% nos últimos 30 dias (${taxaInad.toFixed(1)}%)`,
      target: "inadimplentes",
    });
  }

  const enviados30 = countRows(
    last30Orders,
    (o) => o.kanban_status !== "pedidos_criados"
  );
  const devolvidos30 = countRows(last30Orders, (o) => o.kanban_status === "devolvidos");
  const taxaDev = round2(safeDivide(devolvidos30, enviados30) * 100);
  if (taxaDev > 10) {
    alerts.push({
      id: "devolucao-30d",
      severity: "yellow",
      message: `Taxa de devolução acima de 10% nos últimos 30 dias (${taxaDev.toFixed(1)}%)`,
      target: "inadimplentes",
    });
  }

  const parados = allOrders.filter(
    (o) => o.kanban_status === "requer_atencao" && daysSince(o.updated_at) > 5
  );
  if (parados.length > 0) {
    alerts.push({
      id: "requer-atencao-5d",
      severity: "red",
      message: `${parados.length} pedidos em Requer Atenção há mais de 5 dias sem movimentação`,
      target: "em-risco",
      filter: "requer_atencao",
      orderIds: parados.map((o) => o.id),
    });
  }

  return alerts;
}

function formatBrl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const sellerName = parseSellerParam(searchParams);
  const prev = prevPeriod(from, to);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const prevFromISO = prev.from.toISOString();
  const prevToISO = prev.to.toISOString();

  const last30From = new Date();
  last30From.setDate(last30From.getDate() - 30);
  const last30FromISO = last30From.toISOString();

  try {
    const [periodOrders, prevOrders, operationalOrders, last30Orders, metaAds] =
      await Promise.all([
        fetchPayafterOrders(fromISO, toISO, sellerName),
        fetchPayafterOrders(prevFromISO, prevToISO, sellerName),
        fetchOperationalOrders(sellerName),
        fetchPayafterOrders(last30FromISO, new Date().toISOString(), sellerName),
        fetchMetaAdsInsights(from, to).catch(() => ({ spend: 0 })),
      ]);

    const kpis = computeKpis(periodOrders, prevOrders.length, metaAds.spend ?? 0);
    const alerts = buildAlerts(operationalOrders, last30Orders);
    const funnel = buildFunnel(periodOrders);
    const sellers = buildSellersExpanded(periodOrders);

    const byDay = new Map<string, number>();
    for (const o of periodOrders) {
      const day = o.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const daily = Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const weeklyPaymentRate = buildWeeklyPaymentRate(periodOrders);

    const inadimplentes: PayafterInadimplenteRow[] = periodOrders
      .filter((o) => o.kanban_status === "inadimplentes")
      .map((o) => ({
        id: o.id,
        orderNumber: o.display_id ?? o.order_number ?? o.id.slice(-8).toUpperCase(),
        customerName: o.customer_name,
        customerCpf: o.customer_cpf ?? "",
        customerPhone: o.customer_phone ?? "",
        value: o.value,
        sellerName: o.seller_name ?? "—",
        state: o.state ?? "—",
        createdAt: o.created_at,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const result: PayafterDashboardData = {
      kpis,
      alerts,
      funnel,
      sellers,
      daily,
      weeklyPaymentRate,
      inadimplentes,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar PayAfter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
