import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/require-session";
import {
  fetchMetaAccountInfo,
  getMetaApiVersion,
  maskToken,
  normalizeAccountId,
  setMetaApiVersion,
} from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const [accountsRes, apiVersion] = await Promise.all([
      supabase
        .from("ad_accounts")
        .select(
          "id, account_id, account_name, currency, platform, is_active, created_at, access_token"
        )
        .eq("platform", "meta")
        .order("created_at", { ascending: false }),
      getMetaApiVersion(),
    ]);

    if (accountsRes.error) {
      return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });
    }

    const accounts = (accountsRes.data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      accountName: row.account_name,
      currency: row.currency,
      isActive: row.is_active,
      createdAt: row.created_at,
      tokenMasked: maskToken(row.access_token),
    }));

    return NextResponse.json({ accounts, apiVersion });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao listar contas";
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
      String(body.accountId ?? body.account_id ?? "")
    );
    const accessToken = String(body.accessToken ?? body.access_token ?? "").trim();
    const currencyInput = String(body.currency ?? "").toUpperCase();
    const isActive = body.isActive !== false && body.is_active !== false;
    const apiVersion = body.apiVersion
      ? String(body.apiVersion).trim()
      : await getMetaApiVersion();

    if (!accountId || !accessToken) {
      return NextResponse.json(
        { error: "Account ID e Access Token são obrigatórios." },
        { status: 400 }
      );
    }

    if (body.apiVersion) {
      const versionResult = await setMetaApiVersion(apiVersion);
      if (!versionResult.ok) {
        return NextResponse.json({ error: versionResult.error }, { status: 500 });
      }
    }

    const meta = await fetchMetaAccountInfo(accountId, accessToken, apiVersion);
    if (meta.error) {
      return NextResponse.json({ error: meta.error }, { status: 400 });
    }

    const currency =
      currencyInput === "USD" || currencyInput === "BRL"
        ? currencyInput
        : meta.currency;

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
        .update({
          account_name: meta.name ?? `act_${accountId}`,
          access_token: accessToken,
          currency,
          platform: "meta",
          is_active: isActive,
        })
        .eq("id", existing.id)
        .select(
          "id, account_id, account_name, currency, is_active, created_at, access_token"
        )
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("ad_accounts")
        .insert({
          account_id: accountId,
          account_name: meta.name ?? `act_${accountId}`,
          access_token: accessToken,
          currency,
          platform: "meta",
          is_active: isActive,
        })
        .select(
          "id, account_id, account_name, currency, is_active, created_at, access_token"
        )
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Conta salva, mas não foi possível ler o registro." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      account: {
        id: data.id,
        accountId: data.account_id,
        accountName: data.account_name,
        currency: data.currency,
        isActive: data.is_active,
        createdAt: data.created_at,
        tokenMasked: maskToken(data.access_token),
      },
      apiVersion,
    });
  } catch (err: unknown) {
    console.error("[ad-accounts POST]", err);
    const message = err instanceof Error ? err.message : "Erro interno ao salvar conta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
