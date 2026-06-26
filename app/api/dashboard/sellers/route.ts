import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseSellerParam } from "@/lib/seller-filter";
import type { SellerAgendamento } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(searchParams.get("to") ?? Date.now());
  const sellerName = parseSellerParam(searchParams);

  try {
    let query = supabase
      .from("orders")
      .select("seller_name, seller_id")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());
    if (sellerName) query = query.eq("seller_name", sellerName);

    const { data: orders, error: ordersErr } = await query;
    if (ordersErr) throw ordersErr;

    const countMap = new Map<string, number>();
    for (const o of orders ?? []) {
      const name = (o.seller_name as string | null)?.trim() || "Sem vendedor";
      countMap.set(name, (countMap.get(name) ?? 0) + 1);
    }

    const result: SellerAgendamento[] = Array.from(countMap.entries())
      .map(([sellerName, agendamentos]) => ({
        sellerId: sellerName,
        sellerName,
        agendamentos,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar vendedores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
