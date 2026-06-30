import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { fetchAdAccountNames, normalizeAccountId } from "@/lib/meta-account";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bmId: string }> }
) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { bmId } = await params;
  const body = await req.json();

  const newName = body.name != null ? String(body.name).trim() || null : null;
  const newToken = body.access_token != null ? String(body.access_token).trim() || null : null;
  const accountsToRemove: string[] = Array.isArray(body.accounts_to_remove)
    ? body.accounts_to_remove.map(String)
    : [];
  const accountsToAddRaw: string[] = Array.isArray(body.accounts_to_add)
    ? body.accounts_to_add.map((id: unknown) => normalizeAccountId(String(id))).filter(Boolean)
    : [];

  const now = new Date().toISOString();

  // 1. Se tem contas novas, validar na Meta API antes de salvar qualquer coisa
  if (accountsToAddRaw.length > 0) {
    // Precisamos do token — o novo ou o existente
    let tokenToUse = newToken;
    if (!tokenToUse) {
      const { data: sample } = await supabase
        .from("ad_accounts")
        .select("access_token")
        .eq("bm_id", bmId)
        .limit(1)
        .maybeSingle();
      tokenToUse = sample?.access_token ?? null;
    }
    if (!tokenToUse) {
      return NextResponse.json({ error: "Token não encontrado para esta BM" }, { status: 400 });
    }

    const resolved = await fetchAdAccountNames(accountsToAddRaw, tokenToUse);
    const invalid = resolved.filter((r) => r.error);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Token inválido ou sem permissão para: ${invalid.map((e) => e.account_id).join(", ")}` },
        { status: 400 }
      );
    }

    // Obter bm_name atual caso não venha novo nome
    let bmName = newName;
    if (!bmName) {
      const { data: sample } = await supabase
        .from("ad_accounts")
        .select("bm_name")
        .eq("bm_id", bmId)
        .limit(1)
        .maybeSingle();
      bmName = sample?.bm_name ?? null;
    }

    const rows = resolved.map((r) => ({
      bm_id: bmId,
      bm_name: bmName,
      access_token: tokenToUse!,
      account_id: r.account_id,
      name: r.name ?? `Conta ${r.account_id}`,
      currency: r.currency === "USD" ? "USD" : "BRL",
      is_active: true,
      updated_at: now,
    }));

    const { error: insertError } = await supabase
      .from("ad_accounts")
      .upsert(rows, { onConflict: "account_id" });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  // 2. Atualizar nome e/ou token em todas as contas da BM
  const updates: Record<string, unknown> = { updated_at: now };
  if (newName) updates.bm_name = newName;
  if (newToken) updates.access_token = newToken;

  if (Object.keys(updates).length > 1) {
    const { error: updateError } = await supabase
      .from("ad_accounts")
      .update(updates)
      .eq("bm_id", bmId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  // 3. Remover contas marcadas para exclusão
  if (accountsToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("ad_accounts")
      .delete()
      .eq("bm_id", bmId)
      .in("id", accountsToRemove);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bmId: string }> }
) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { bmId } = await params;

  // Remove todas as contas da BM; NÃO toca em meta_ads_cache (histórico preservado)
  const { data: deleted, error } = await supabase
    .from("ad_accounts")
    .delete()
    .eq("bm_id", bmId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true, accounts_removed: deleted?.length ?? 0 });
}
