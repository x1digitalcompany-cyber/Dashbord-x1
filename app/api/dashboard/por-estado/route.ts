import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { round2, safeDivide, SALE_STATUS } from "@/lib/finance";
import type { EstadoMetric } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(searchParams.get("to") ?? Date.now());

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("estado, state, value, kanban_status")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    if (error) throw error;

    const map = new Map<string, EstadoMetric>();

    for (const o of orders ?? []) {
      const uf = (
        (o.estado as string | null)?.toUpperCase().slice(0, 2) ||
        (o.state as string | null)?.toUpperCase().slice(0, 2) ||
        ""
      );
      if (!uf || uf.length !== 2) continue;

      const cur = map.get(uf) ?? {
        uf,
        vendas: 0,
        faturamento: 0,
        inadimplentes: 0,
        valor_inadimplente: 0,
        taxa_inadimplencia: 0,
      };

      const value = Number(o.value) || 0;
      const isRevenue =
        o.kanban_status === "pagos" || o.kanban_status === "inadimplentes";

      if (isRevenue) cur.faturamento += value;
      if (o.kanban_status === SALE_STATUS) cur.vendas += 1;
      if (o.kanban_status === "inadimplentes") {
        cur.inadimplentes += 1;
        cur.valor_inadimplente += value;
      }

      map.set(uf, cur);
    }

    const result: EstadoMetric[] = Array.from(map.values())
      .map((row) => ({
        ...row,
        faturamento: round2(row.faturamento),
        valor_inadimplente: round2(row.valor_inadimplente),
        taxa_inadimplencia: round2(
          safeDivide(row.valor_inadimplente, row.faturamento) * 100
        ),
      }))
      .sort((a, b) => b.faturamento - a.faturamento);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar por estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
