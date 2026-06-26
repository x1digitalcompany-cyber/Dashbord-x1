import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseSellerParam } from "@/lib/seller-filter";
import { PAYAFTER_TYPES, daysSince } from "@/lib/payafter";
import type { PayafterEmRiscoRow } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sellerName = parseSellerParam(searchParams);

  try {
    let q = supabase
      .from("orders")
      .select(
        "id, order_number, display_id, customer_name, customer_phone, value, updated_at, seller_name, kanban_status, payment_type"
      )
      .eq("kanban_status", "entregue")
      .in("payment_type", PAYAFTER_TYPES)
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .order("updated_at", { ascending: true });

    if (sellerName) q = q.eq("seller_name", sellerName);

    const { data, error } = await q;
    if (error) throw error;

    const rows: PayafterEmRiscoRow[] = (data ?? []).map((o) => ({
      id: o.id,
      orderNumber: (o.display_id as string | null) ?? (o.order_number as string) ?? o.id.slice(-8).toUpperCase(),
      customerName: o.customer_name as string,
      customerPhone: (o.customer_phone as string | null) ?? "",
      value: Number(o.value),
      updatedAt: o.updated_at as string,
      daysDelivered: daysSince(o.updated_at as string),
      sellerName: (o.seller_name as string | null) ?? "—",
      urgency:
        daysSince(o.updated_at as string) > 15
          ? "high"
          : daysSince(o.updated_at as string) > 7
            ? "medium"
            : "low",
    }));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pedidos em risco";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
