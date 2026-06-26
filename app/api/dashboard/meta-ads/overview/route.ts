import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";
import { fetchMetaAccountInfo } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { from, to } = parseFromToParams(req.nextUrl.searchParams);
  const since = from.toISOString().slice(0, 10);
  const until = to.toISOString().slice(0, 10);

  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select("id, bm_id, bm_name, account_id, name, access_token, currency, is_active")
    .order("bm_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bmMap = new Map<
    string,
    {
      bmId: string;
      bmName: string;
      totalAccounts: number;
      activeAccounts: number;
      spend: number;
      errors: string[];
    }
  >();

  let totalSpend = 0;

  for (const acc of accounts ?? []) {
    const bmKey = acc.bm_id ?? "sem-bm";
    const bmName = acc.bm_name ?? acc.bm_id ?? "Sem BM";
    if (!bmMap.has(bmKey)) {
      bmMap.set(bmKey, {
        bmId: bmKey,
        bmName,
        totalAccounts: 0,
        activeAccounts: 0,
        spend: 0,
        errors: [],
      });
    }
    const bm = bmMap.get(bmKey)!;
    bm.totalAccounts += 1;
    if (acc.is_active) bm.activeAccounts += 1;

    if (!acc.is_active) continue;

    try {
      const version = "v19.0";
      const url =
        `https://graph.facebook.com/${version}/act_${acc.account_id}/insights` +
        `?fields=spend&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
        `&access_token=${acc.access_token}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.error) {
        bm.errors.push(`${acc.name ?? acc.account_id}: ${json.error.message}`);
        continue;
      }
      const spend = Number(json.data?.[0]?.spend ?? 0);
      bm.spend += spend;
      totalSpend += spend;
    } catch (err) {
      bm.errors.push(`${acc.name ?? acc.account_id}: ${String(err)}`);
    }
  }

  const healthChecks = await Promise.all(
    (accounts ?? [])
      .filter((a) => a.is_active)
      .map(async (a) => {
        const info = await fetchMetaAccountInfo(a.account_id, a.access_token);
        return { bm_id: a.bm_id, ok: !info.error };
      })
  );

  const businessManagers = Array.from(bmMap.values()).map((bm) => ({
    ...bm,
    verified:
      healthChecks.filter((h) => h.bm_id === bm.bmId).every((h) => h.ok) &&
      bm.activeAccounts > 0,
  }));

  return NextResponse.json({
    businessManagers,
    totalSpend,
    period: { since, until },
    totalAccounts: accounts?.length ?? 0,
    activeAccounts: accounts?.filter((a) => a.is_active).length ?? 0,
  });
}
