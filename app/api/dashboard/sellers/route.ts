import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { SellerAgendamento } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from      = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to        = new Date(searchParams.get("to")   ?? Date.now());
  const sellerIds = searchParams.get("sellerIds")?.split(",").filter(Boolean) ?? [];

  try {
    // Busca sellers ativos
    let sellersQuery = supabase
      .from("sellers")
      .select("id, name")
      .eq("is_active", true);
    if (sellerIds.length > 0) {
      sellersQuery = sellersQuery.in("id", sellerIds);
    }
    const { data: sellers, error: sellersErr } = await sellersQuery;
    if (sellersErr) throw sellersErr;

    if (!sellers?.length) return NextResponse.json([]);

    // Conta pedidos por seller no período
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("seller_id")
      .in("seller_id", sellers.map((s) => s.id))
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());
    if (ordersErr) throw ordersErr;

    // Agrupa por seller
    const countMap: Record<string, number> = {};
    for (const o of orders ?? []) {
      if (o.seller_id) countMap[o.seller_id] = (countMap[o.seller_id] ?? 0) + 1;
    }

    const result: SellerAgendamento[] = sellers
      .map((s) => ({
        sellerId:     s.id,
        sellerName:   s.name,
        agendamentos: countMap[s.id] ?? 0,
      }))
      .sort((a, b) => b.agendamentos - a.agendamentos);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar vendedores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
