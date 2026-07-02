import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const token = await requireSession(req);
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { name } = await params;
  const sellerName = decodeURIComponent(name);
  const { from, to } = parseFromToParams(req.nextUrl.searchParams);

  const [{ data: orders, error: ordersErr }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number, display_id, customer_name, kanban_status, value, payment_type, created_at, tracking_code, city, state")
      .eq("seller_name", sellerName)
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

  return NextResponse.json({ orders: orders ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const token = await requireSession(req);
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { name } = await params;
  const sellerName = decodeURIComponent(name);
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
  if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
  if (body.cpf !== undefined) updates.cpf = body.cpf ? String(body.cpf).trim() : null;
  if (body.modelo_salario !== undefined) {
    updates.modelo_salario =
      body.modelo_salario === "fixo_mais_comissao" ? "fixo_mais_comissao" : "so_comissao";
  }
  if (body.meta_mensal !== undefined) updates.meta_mensal = Number(body.meta_mensal) || 0;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  // Upsert: if seller doesn't exist in table yet, create it
  const { error } = await supabase
    .from("sellers")
    .upsert({ name: sellerName, ...updates }, { onConflict: "name" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
