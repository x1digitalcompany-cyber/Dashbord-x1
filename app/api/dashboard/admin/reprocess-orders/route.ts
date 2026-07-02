import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";

// Old kanban_status names that existed before migrations 005/006
const STATUS_REMAP: Record<string, string> = {
  chegou: "pedidos_criados",
  transito: "em_transito",
  enviado: "em_transito",
  retirar: "retirar_correios",
  atencao: "requer_atencao",
  "requer_atençao": "requer_atencao",
};

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const errors: string[] = [];
  let status_fixed = 0;
  let sellers_synced = 0;

  // 1. Normalize old kanban_status values
  for (const [oldStatus, newStatus] of Object.entries(STATUS_REMAP)) {
    const { error } = await supabase
      .from("orders")
      .update({ kanban_status: newStatus })
      .eq("kanban_status", oldStatus);
    if (error) errors.push(`status ${oldStatus}: ${error.message}`);
    else status_fixed++;
  }

  // 2. Antecipado orders that ended up with "pagos" status → "entregue"
  //    (migration 006 should have done this, but new imports may have missed it)
  const { error: antErr } = await supabase
    .from("orders")
    .update({ kanban_status: "entregue" })
    .eq("kanban_status", "pagos")
    .eq("payment_type", "antecipado");
  if (antErr) errors.push(`antecipado fix: ${antErr.message}`);

  // 3. Fill NULL payment_type → "agendado" (Five default)
  const { error: ptErr } = await supabase
    .from("orders")
    .update({ payment_type: "agendado" })
    .is("payment_type", null);
  if (ptErr) errors.push(`payment_type: ${ptErr.message}`);

  // 4. Upsert sellers from all distinct seller_name values in orders
  const { data: sellerRows, error: selFetchErr } = await supabase
    .from("orders")
    .select("seller_name")
    .not("seller_name", "is", null)
    .neq("seller_name", "");

  if (selFetchErr) {
    errors.push(`sellers fetch: ${selFetchErr.message}`);
  } else {
    const names = [
      ...new Set(
        (sellerRows ?? [])
          .map((r) => (r.seller_name as string | null)?.trim())
          .filter((n): n is string => !!n)
      ),
    ];
    if (names.length > 0) {
      const { error: upsErr } = await supabase
        .from("sellers")
        .upsert(
          names.map((name) => ({ name })),
          { onConflict: "name", ignoreDuplicates: true }
        );
      if (upsErr) errors.push(`sellers upsert: ${upsErr.message}`);
      else sellers_synced = names.length;
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    status_fixed,
    sellers_synced,
    errors,
  });
}
