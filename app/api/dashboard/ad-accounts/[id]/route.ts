import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/require-session";
import {
  fetchMetaAccountInfo,
  maskToken,
  normalizeAccountId,
} from "@/lib/meta-account";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();

    const { data: existing, error: findErr } = await supabase
      .from("ad_accounts")
      .select("id, account_id, access_token")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};

    if (body.accountId != null || body.account_id != null) {
      patch.account_id = normalizeAccountId(
        String(body.accountId ?? body.account_id)
      );
    }
    if (body.accessToken != null || body.access_token != null) {
      const t = String(body.accessToken ?? body.access_token).trim();
      if (t) patch.access_token = t;
    }
    if (body.currency != null) patch.currency = String(body.currency).toUpperCase();
    if (body.isActive != null) patch.is_active = Boolean(body.isActive);
    if (body.is_active != null) patch.is_active = Boolean(body.is_active);
    if (body.accountName != null) patch.name = String(body.accountName);

    const accountId = (patch.account_id as string) ?? existing.account_id;
    const accessToken = (patch.access_token as string) ?? existing.access_token;

    if (patch.account_id || patch.access_token) {
      const meta = await fetchMetaAccountInfo(accountId, accessToken);
      if (meta.error) {
        return NextResponse.json({ error: meta.error }, { status: 400 });
      }
      if (meta.name && !patch.name) patch.name = meta.name;
      if (!body.currency) patch.currency = meta.currency;
    }

    const { data, error } = await supabase
      .from("ad_accounts")
      .update(patch)
      .eq("id", id)
      .select(
        "id, account_id, name, currency, is_active, created_at, access_token"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      account: {
        id: data.id,
        accountId: data.account_id,
        accountName: data.name,
        currency: data.currency,
        isActive: data.is_active,
        createdAt: data.created_at,
        tokenMasked: maskToken(data.access_token),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { error } = await supabase.from("ad_accounts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao remover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
