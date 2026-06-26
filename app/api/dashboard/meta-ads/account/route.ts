import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/require-session";
import {
  maskAccountId,
  maskToken,
  normalizeAccountId,
  testMetaAdsConnection,
} from "@/lib/meta-account";
import { getLastMetaFetchAt } from "@/lib/api/meta-ads";

function serializeAccount(row: {
  id: string;
  account_id: string;
  name: string | null;
  currency: string;
  is_active: boolean;
  api_version: string | null;
  last_fetch_at: string | null;
  created_at: string;
  access_token: string;
}) {
  return {
    id: row.id,
    accountId: row.account_id,
    accountIdMasked: maskAccountId(row.account_id),
    name: row.name,
    currency: row.currency,
    isActive: row.is_active,
    apiVersion: row.api_version ?? "v19.0",
    lastFetchAt: row.last_fetch_at,
    createdAt: row.created_at,
    tokenMasked: maskToken(row.access_token),
  };
}

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const [accountRes, lastFetchAt] = await Promise.all([
      supabase
        .from("ad_accounts")
        .select(
          "id, account_id, name, currency, is_active, api_version, last_fetch_at, created_at, access_token"
        )
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      getLastMetaFetchAt(),
    ]);

    if (accountRes.error) {
      return NextResponse.json({ error: accountRes.error.message }, { status: 500 });
    }

    if (!accountRes.data) {
      return NextResponse.json({ account: null, lastFetchAt });
    }

    return NextResponse.json({
      account: serializeAccount(accountRes.data),
      lastFetchAt: accountRes.data.last_fetch_at ?? lastFetchAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar conta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const accountId = normalizeAccountId(
      String(body.account_id ?? body.accountId ?? "")
    );
    const accessToken = String(body.access_token ?? body.accessToken ?? "").trim();
    const name = body.name ? String(body.name).trim() : null;
    const apiVersion = String(body.api_version ?? body.apiVersion ?? "v19.0")
      .trim()
      .replace(/^v?/, "v");

    if (!accountId || !accessToken) {
      return NextResponse.json(
        { error: "Account ID e Access Token são obrigatórios." },
        { status: 400 }
      );
    }

    const test = await testMetaAdsConnection(accountId, accessToken, apiVersion);
    if (!test.ok) {
      return NextResponse.json({ error: test.error ?? "Falha ao validar conta" }, { status: 400 });
    }

    const currency =
      body.currency === "USD" || body.currency === "BRL"
        ? body.currency
        : test.currency === "USD"
          ? "USD"
          : "BRL";

    await supabase.from("ad_accounts").update({ is_active: false }).neq("account_id", accountId);

    const payload = {
      account_id: accountId,
      access_token: accessToken,
      name: name || test.name || null,
      currency,
      api_version: apiVersion,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("account_id", accountId)
      .maybeSingle();

    let data;
    let error;

    if (existing?.id) {
      const result = await supabase
        .from("ad_accounts")
        .update(payload)
        .eq("id", existing.id)
        .select(
          "id, account_id, name, currency, is_active, api_version, last_fetch_at, created_at, access_token"
        )
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("ad_accounts")
        .insert(payload)
        .select(
          "id, account_id, name, currency, is_active, api_version, last_fetch_at, created_at, access_token"
        )
        .single();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Falha ao salvar" }, { status: 500 });
    }

    return NextResponse.json({ account: serializeAccount(data) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao salvar conta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { data: active } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (active?.id) {
      await supabase.from("ad_accounts").update({ is_active: false }).eq("id", active.id);
    }

    await supabase.from("meta_ads_cache").delete().not("cache_key", "is", null);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao remover conta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
