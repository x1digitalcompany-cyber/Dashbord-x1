import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/require-session";
import { getMetaApiVersion, testMetaAccount } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const apiVersion = await getMetaApiVersion();

    const { data: accounts, error } = await supabase
      .from("ad_accounts")
      .select("id, account_id, name, access_token, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = await Promise.all(
      (accounts ?? []).map(async (acc) => {
        if (!acc.is_active) {
          return {
            id: acc.id,
            accountId: acc.account_id,
            accountName: acc.name,
            status: "inactive" as const,
            message: "Conta desativada",
          };
        }
        const test = await testMetaAccount(
          acc.account_id,
          acc.access_token,
          apiVersion
        );
        return {
          id: acc.id,
          accountId: acc.account_id,
          accountName: acc.name,
          status: test.ok ? ("ok" as const) : ("error" as const),
          message: test.ok
            ? `Conectado — ${test.metaName ?? acc.name}`
            : test.message,
        };
      })
    );

    const ok = results.filter((r) => r.status === "ok").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      apiVersion,
      total: results.length,
      ok,
      errors,
      accounts: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro no teste";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
