import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { maskAccountId, maskToken } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ad_accounts")
    .select(
      "id, bm_id, bm_name, account_id, name, currency, is_active, access_token, created_at, updated_at"
    )
    .order("bm_name", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bmMap = new Map<
    string,
    {
      bmId: string;
      bmName: string;
      accounts: Array<{
        id: string;
        accountId: string;
        accountIdMasked: string;
        name: string | null;
        currency: string;
        isActive: boolean;
        tokenMasked: string;
        createdAt: string;
      }>;
      totalAccounts: number;
      activeAccounts: number;
    }
  >();

  for (const row of data ?? []) {
    const bmKey = row.bm_id ?? "sem-bm";
    const bmName = row.bm_name ?? row.bm_id ?? "Sem BM";
    if (!bmMap.has(bmKey)) {
      bmMap.set(bmKey, {
        bmId: bmKey,
        bmName,
        accounts: [],
        totalAccounts: 0,
        activeAccounts: 0,
      });
    }
    const bm = bmMap.get(bmKey)!;
    bm.accounts.push({
      id: row.id,
      accountId: row.account_id,
      accountIdMasked: maskAccountId(row.account_id),
      name: row.name,
      currency: row.currency ?? "BRL",
      isActive: row.is_active,
      tokenMasked: maskToken(row.access_token),
      createdAt: row.created_at,
    });
    bm.totalAccounts += 1;
    if (row.is_active) bm.activeAccounts += 1;
  }

  return NextResponse.json({
    businessManagers: Array.from(bmMap.values()),
    totalAccounts: data?.length ?? 0,
  });
}
