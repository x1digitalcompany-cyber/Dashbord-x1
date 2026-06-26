import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** Vendedores distintos a partir de orders.seller_name (dados reais do webhook). */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("seller_name")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .not("seller_name", "is", null)
      .neq("seller_name", "")
      .order("seller_name");

    if (error) throw error;

    const names = [
      ...new Set(
        (data ?? [])
          .map((r) => (r.seller_name as string)?.trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    return NextResponse.json(names.map((name) => ({ id: name, name })));
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao buscar vendedores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
