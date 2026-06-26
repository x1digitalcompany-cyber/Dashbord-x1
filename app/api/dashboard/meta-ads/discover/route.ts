import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { fetchAdAccountNames } from "@/lib/meta-account";
import { supabase } from "@/lib/supabase";
import { normalizeAccountId } from "@/lib/meta-account";

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const bm_id = String(body.bm_id ?? "").trim();
  const access_token = String(body.access_token ?? "").trim();
  const raw = body.account_ids;

  if (!bm_id || !access_token) {
    return NextResponse.json(
      { error: "bm_id e access_token são obrigatórios" },
      { status: 400 }
    );
  }

  const ids = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[,\s\n]+/))
    .map((s: string) => normalizeAccountId(s))
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "account_ids vazio — informe ao menos 1 ID" },
      { status: 400 }
    );
  }

  const resolved = await fetchAdAccountNames(ids, access_token);

  const { data: existing } = await supabase
    .from("ad_accounts")
    .select("account_id")
    .in("account_id", ids);

  const existingSet = new Set((existing ?? []).map((r) => r.account_id));

  return NextResponse.json({
    accounts: resolved.map((r) => ({
      account_id: r.account_id,
      name: r.name,
      currency: r.currency ?? "BRL",
      error: r.error,
      already_registered: existingSet.has(r.account_id),
    })),
  });
}
