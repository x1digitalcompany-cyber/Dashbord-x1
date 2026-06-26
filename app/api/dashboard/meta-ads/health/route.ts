import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { fetchMetaAccountInfo } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select("id, bm_id, bm_name, account_id, name, access_token, is_active")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.all(
    (accounts ?? []).map(async (a) => {
      const info = await fetchMetaAccountInfo(a.account_id, a.access_token);
      return {
        id: a.id,
        bm_id: a.bm_id,
        bm_name: a.bm_name,
        account_id: a.account_id,
        name: a.name,
        status: info.error ? ("error" as const) : ("ok" as const),
        error_message: info.error,
        meta_name: info.name,
        account_status: info.accountStatus,
      };
    })
  );

  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ total: results.length, ok, errors, accounts: results });
}
