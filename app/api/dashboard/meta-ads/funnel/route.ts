import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";
import { ENVIADOS_STATUSES, ENTREGUES_STATUSES, pct } from "@/lib/payafter";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import type { KanbanColumn } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
  const sellerName = parseSellerParam(searchParams);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  try {
    const meta = await fetchMetaAdsInsights(from, to);

    let q = supabase
      .from("orders")
      .select("kanban_status")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    if (sellerName) q = q.eq("seller_name", sellerName);
    const { data: orders } = await q;

    const { count: agendamentos } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromISO)
      .lte("created_at", toISO);

    const rows = orders ?? [];
    const pedidosCriados = rows.length;
    const enviados = rows.filter((o) =>
      ENVIADOS_STATUSES.includes(o.kanban_status as KanbanColumn)
    ).length;
    const entregues = rows.filter((o) =>
      ENTREGUES_STATUSES.includes(o.kanban_status as KanbanColumn)
    ).length;
    const pagos = rows.filter((o) => o.kanban_status === "pagos").length;

    const steps = [
      { id: "leads", label: "Leads (Meta)", count: meta.leads },
      { id: "agendamentos", label: "Agendamentos", count: agendamentos ?? 0 },
      { id: "pedidos", label: "Pedidos Criados", count: pedidosCriados },
      { id: "enviados", label: "Enviados", count: enviados },
      { id: "entregues", label: "Entregues", count: entregues },
      { id: "pagos", label: "Pagos", count: pagos },
    ];

    const funnel = steps.map((step, i) => ({
      ...step,
      conversionPct: i === 0 ? 100 : pct(step.count, steps[i - 1].count),
    }));

    return NextResponse.json({ funnel, metaConfigured: !meta.mock });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao montar funil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
