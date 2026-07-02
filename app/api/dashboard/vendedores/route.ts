import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";

interface OrderRow {
  seller_name: string | null;
  kanban_status: string;
  payment_type: string | null;
  value: number | string | null;
}

interface SellerRow {
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  is_active: boolean;
  modelo_salario: string;
  meta_mensal: number | string;
}

function toNum(v: number | string | null): number {
  return Number(v) || 0;
}

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { from, to } = parseFromToParams(req.nextUrl.searchParams);

  const [{ data: sellersRaw, error: sellersErr }, { data: ordersRaw, error: ordersErr }] =
    await Promise.all([
      supabase
        .from("sellers")
        .select("name, email, phone, cpf, is_active, modelo_salario, meta_mensal")
        .order("name"),
      supabase
        .from("orders")
        .select("seller_name, kanban_status, payment_type, value")
        .not("seller_name", "is", null)
        .neq("seller_name", "")
        .neq("customer_email", "cliente@example.com")
        .not("customer_name", "ilike", "%cliente fict%")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString()),
    ]);

  if (sellersErr) return NextResponse.json({ error: sellersErr.message }, { status: 500 });
  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

  const sellers = (sellersRaw ?? []) as SellerRow[];
  const orders = (ordersRaw ?? []) as OrderRow[];

  // Build stats map from orders
  const statsMap = new Map<string, {
    pedidos: number;
    entregues: number;
    pagos: number;
    inadimplentes: number;
    devolvidos: number;
    faturamento: number;
  }>();

  for (const o of orders) {
    const name = (o.seller_name ?? "").trim();
    if (!name) continue;
    if (!statsMap.has(name)) {
      statsMap.set(name, { pedidos: 0, entregues: 0, pagos: 0, inadimplentes: 0, devolvidos: 0, faturamento: 0 });
    }
    const s = statsMap.get(name)!;
    s.pedidos += 1;
    if (o.kanban_status === "entregue") s.entregues += 1;
    if (o.kanban_status === "pagos") s.pagos += 1;
    if (o.kanban_status === "inadimplentes") s.inadimplentes += 1;
    if (o.kanban_status === "devolvidos") s.devolvidos += 1;
    // antecipado: "entregue" is the final paid state; agendado: "pagos"
    if (
      o.kanban_status === "pagos" ||
      (o.kanban_status === "entregue" && o.payment_type === "antecipado")
    ) {
      s.faturamento += toNum(o.value);
    }
  }

  // Merge sellers table with stats — sellers table is the source of truth for metadata
  const sellerMap = new Map<string, SellerRow>();
  for (const s of sellers) sellerMap.set(s.name, s);

  // Also include names from orders that aren't in sellers table yet
  for (const name of statsMap.keys()) {
    if (!sellerMap.has(name)) {
      sellerMap.set(name, {
        name,
        email: null,
        phone: null,
        cpf: null,
        is_active: true,
        modelo_salario: "so_comissao",
        meta_mensal: 0,
      });
    }
  }

  const result = [...sellerMap.values()].map((seller) => {
    const stats = statsMap.get(seller.name) ?? {
      pedidos: 0, entregues: 0, pagos: 0, inadimplentes: 0, devolvidos: 0, faturamento: 0,
    };
    const meta = toNum(seller.meta_mensal);
    return {
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      cpf: seller.cpf,
      is_active: seller.is_active,
      modelo_salario: seller.modelo_salario,
      meta_mensal: meta,
      pedidos: stats.pedidos,
      entregues: stats.entregues,
      pagos: stats.pagos,
      inadimplentes: stats.inadimplentes,
      devolvidos: stats.devolvidos,
      faturamento: stats.faturamento,
      ticket_medio: stats.pagos > 0 ? stats.faturamento / stats.pagos : 0,
      taxa_inadimplencia: stats.pedidos > 0 ? (stats.inadimplentes / stats.pedidos) * 100 : 0,
      meta_pct: meta > 0 ? Math.min((stats.faturamento / meta) * 100, 100) : 0,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  return NextResponse.json({ sellers: result });
}

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const { error } = await supabase.from("sellers").insert({
    name,
    email: body.email ? String(body.email).trim() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    cpf: body.cpf ? String(body.cpf).trim() : null,
    modelo_salario: body.modelo_salario === "fixo_mais_comissao" ? "fixo_mais_comissao" : "so_comissao",
    meta_mensal: Number(body.meta_mensal) || 0,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um vendedor com esse nome" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
