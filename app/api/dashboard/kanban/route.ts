import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { AGENDADO_PAYMENT_TYPES } from "@/lib/five-webhook";
import type { KanbanColumn, KanbanColumns, KanbanOrder } from "@/types";

const VALID_COLUMNS: KanbanColumn[] = [
  "chegou",
  "retirar_correios",
  "pagos",
  "devolvidos",
  "inadimplentes",
];

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo");

  try {
    let query = supabase
      .from("orders")
      .select(`
        id, order_number, display_id, customer_name, customer_email,
        customer_phone, customer_cpf, customer_doc, value, payment_method,
        gateway, kanban_status, product_name, offer_title, tracking_code, tracking_url,
        payment_type, seller_name, project_name, shipping_platform, address_full,
        street, number, complement, neighborhood, city, state, zip_code,
        paid_at, created_at, updated_at,
        sellers ( name )
      `)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (tipo === "antecipado") {
      query = query.eq("payment_type", "antecipado");
    } else if (tipo === "agendado") {
      query = query.in("payment_type", [...AGENDADO_PAYMENT_TYPES]);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const columns: KanbanColumns = {
      chegou:           [],
      retirar_correios: [],
      pagos:            [],
      devolvidos:       [],
      inadimplentes:    [],
    };

    for (const o of orders ?? []) {
      const col = (VALID_COLUMNS.includes(o.kanban_status as KanbanColumn)
        ? o.kanban_status
        : "chegou") as KanbanColumn;

      const rawOrderNum: string = o.order_number ?? "";
      const card: KanbanOrder = {
        id:               o.id,
        orderNumber:      rawOrderNum,
        displayId:        (o.display_id as string | null) ?? rawOrderNum.slice(-8).toUpperCase(),
        customerName:     o.customer_name,
        customerEmail:    o.customer_email ?? "",
        customerPhone:    o.customer_phone ?? "",
        customerCpf:      o.customer_cpf   ?? "",
        customerDoc:      o.customer_doc   ?? undefined,
        value:            Number(o.value),
        paymentMethod:    o.payment_method ?? "PIX",
        status:           col,
        productName:      o.product_name,
        offerTitle:       o.offer_title        ?? undefined,
        sellerName:       (o.seller_name as string | null)
                            ?? (o.sellers as unknown as { name: string } | null)?.name
                            ?? undefined,
        projectName:      o.project_name       ?? undefined,
        shippingPlatform: o.shipping_platform  ?? undefined,
        addressFull:      o.address_full       ?? undefined,
        trackingCode:     o.tracking_code      ?? undefined,
        trackingUrl:      o.tracking_url       ?? undefined,
        createdAt:        o.created_at,
        updatedAt:        o.updated_at,
        paidAt:           o.paid_at            ?? undefined,
        address:          o.street
          ? {
              street:       o.street,
              number:       o.number       ?? "",
              complement:   o.complement   ?? undefined,
              neighborhood: o.neighborhood ?? "",
              city:         o.city         ?? "",
              state:        o.state        ?? "",
              zipCode:      o.zip_code     ?? "",
            }
          : undefined,
      };
      columns[col].push(card);
    }

    const all = Object.values(columns).flat();
    const metrics = {
      total: all.length,
      paidValue: all
        .filter((o) => o.status === "pagos")
        .reduce((s, o) => s + o.value, 0),
      inadimplentesCount: all.filter((o) => o.status === "inadimplentes").length,
    };

    return NextResponse.json({ columns, metrics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pedidos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, column } = (await req.json()) as {
      orderId: string;
      column: KanbanColumn;
    };

    if (!VALID_COLUMNS.includes(column)) {
      return NextResponse.json({ error: "Coluna inválida" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ kanban_status: column })
      .eq("id", orderId)
      .select("id, kanban_status")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao mover pedido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
