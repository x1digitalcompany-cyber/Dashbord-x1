import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { AGENDADO_PAYMENT_TYPES } from "@/lib/five-webhook";
import { isKanbanColumn } from "@/lib/kanban-utils";
import { parseSellerParam } from "@/lib/seller-filter";
import type { KanbanColumn, KanbanColumns, KanbanOrder } from "@/types";

function resolveTipo(raw: string | null): "antecipado" | "agendado" {
  return raw === "agendado" ? "agendado" : "antecipado";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tipo = resolveTipo(searchParams.get("tipo"));
  const sellerName = parseSellerParam(searchParams);

  try {
    let query = supabase
      .from("orders")
      .select(`
        id, order_number, display_id, customer_name, customer_email,
        customer_phone, customer_cpf, customer_doc, value, payment_method,
        gateway, kanban_status, product_name, offer_title, tracking_code, tracking_url,
        payment_type, seller_id, seller_name, project_name, shipping_platform, address_full,
        street, number, complement, neighborhood, city, state, zip_code,
        paid_at, created_at, updated_at,
        sellers ( name )
      `)
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (sellerName) {
      query = query.eq("seller_name", sellerName);
    }

    if (tipo === "antecipado") {
      query = query.or(
        "payment_type.eq.antecipado,payment_type.is.null"
      );
    } else {
      query = query.in("payment_type", [...AGENDADO_PAYMENT_TYPES]);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const rows = orders ?? [];

    const columns: KanbanColumns = {
      pedidos_criados:  [],
      em_transito:      [],
      retirar_correios: [],
      requer_atencao:   [],
      entregue:         [],
      pagos:            [],
      devolvidos:       [],
      inadimplentes:    [],
    };

    for (const o of rows) {
      const col = (
        isKanbanColumn(o.kanban_status) ? o.kanban_status : "pedidos_criados"
      ) as KanbanColumn;

      const rawOrderNum: string = o.order_number ?? "";
      const card: KanbanOrder = {
        id: o.id,
        orderNumber: rawOrderNum,
        displayId:
          (o.display_id as string | null) ??
          rawOrderNum.slice(-8).toUpperCase(),
        customerName: o.customer_name,
        customerEmail: o.customer_email ?? "",
        customerPhone: o.customer_phone ?? "",
        customerCpf: o.customer_cpf ?? "",
        customerDoc: o.customer_doc ?? undefined,
        value: Number(o.value),
        paymentMethod: o.payment_method ?? "PIX",
        status: col,
        productName: o.product_name,
        offerTitle: o.offer_title ?? undefined,
        sellerName:
          (o.seller_name as string | null) ??
          (o.sellers as unknown as { name: string } | null)?.name ??
          undefined,
        projectName: o.project_name ?? undefined,
        shippingPlatform: o.shipping_platform ?? undefined,
        addressFull: o.address_full ?? undefined,
        trackingCode: o.tracking_code ?? undefined,
        trackingUrl: o.tracking_url ?? undefined,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        paidAt: o.paid_at ?? undefined,
        address: o.street
          ? {
              street: o.street,
              number: o.number ?? "",
              complement: o.complement ?? undefined,
              neighborhood: o.neighborhood ?? "",
              city: o.city ?? "",
              state: o.state ?? "",
              zipCode: o.zip_code ?? "",
            }
          : undefined,
      };
      columns[col].push(card);
    }

    const metrics = {
      total: rows.length,
      paidValue: rows
        .filter((o) => o.kanban_status === "pagos")
        .reduce((s, o) => s + Number(o.value), 0),
      inadimplentesCount:   rows.filter((o) => o.kanban_status === "inadimplentes").length,
      emTransitoCount:      rows.filter((o) => o.kanban_status === "em_transito").length,
      requerAtencaoCount:   rows.filter((o) => o.kanban_status === "requer_atencao").length,
    };

    return NextResponse.json({ columns, metrics, tipo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar pedidos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orderId?: string;
      column?: KanbanColumn;
      kanban_status?: KanbanColumn;
    };

    const orderId = body.orderId;
    const column = body.column ?? body.kanban_status;

    if (!orderId || !column) {
      return NextResponse.json(
        { error: "orderId e column (ou kanban_status) são obrigatórios" },
        { status: 400 }
      );
    }

    if (!isKanbanColumn(column)) {
      return NextResponse.json({ error: "Coluna inválida" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        kanban_status: column,
        updated_at: new Date().toISOString(),
      })
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
