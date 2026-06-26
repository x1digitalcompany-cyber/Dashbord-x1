import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { normalizeAccountId } from "@/lib/meta-account";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const bm_id = String(body.bm_id ?? "").trim();
  const bm_name = String(body.bm_name ?? "").trim() || null;
  const access_token = String(body.access_token ?? "").trim();
  const accountsRaw = Array.isArray(body.accounts) ? body.accounts : [];

  if (!bm_id || !access_token || accountsRaw.length === 0) {
    return NextResponse.json(
      { error: "bm_id, access_token e accounts são obrigatórios" },
      { status: 400 }
    );
  }

  interface BulkRow {
    bm_id: string;
    bm_name: string | null;
    access_token: string;
    account_id: string;
    name: string | null;
    currency: string;
    is_active: boolean;
    updated_at: string;
  }

  const rows: BulkRow[] = accountsRaw
    .map(
      (a: {
        account_id?: unknown;
        name?: unknown;
        currency?: unknown;
      }): BulkRow => ({
        bm_id,
        bm_name,
        access_token,
        account_id: normalizeAccountId(String(a.account_id ?? "")),
        name: String(a.name ?? "").trim() || null,
        currency: String(a.currency ?? "").toUpperCase() === "USD" ? "USD" : "BRL",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
    )
    .filter((r: BulkRow) => r.account_id);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma conta válida para salvar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ad_accounts")
    .upsert(rows, { onConflict: "account_id" })
    .select(
      "id, bm_id, bm_name, account_id, name, currency, is_active, created_at"
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data, count: data?.length ?? 0 });
}
