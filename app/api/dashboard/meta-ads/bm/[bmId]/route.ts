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
  // "sem-bm" é o placeholder usado quando bm_id é null — WHERE bm_id = 'sem-bm' não bate com NULL
  const isNullBm = bmId === "sem-bm";

  // 1. Se tem contas novas, validar na Meta API antes de salvar qualquer coisa
  if (accountsToAddRaw.length > 0) {
    let tokenToUse = newToken;
    if (!tokenToUse) {
      const q = supabase.from("ad_accounts").select("access_token").limit(1);
      const { data: sample } = await (isNullBm ? q.is("bm_id", null) : q.eq("bm_id", bmId)).maybeSingle();
      tokenToUse = (sample as { access_token?: string } | null)?.access_token ?? null;
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

    let bmName = newName;
    if (!bmName) {
      const q2 = supabase.from("ad_accounts").select("bm_name").limit(1);
      const { data: sample2 } = await (isNullBm ? q2.is("bm_id", null) : q2.eq("bm_id", bmId)).maybeSingle();
      bmName = (sample2 as { bm_name?: string } | null)?.bm_name ?? null;
    }

    const rows = resolved.map((r) => ({
      bm_id:        isNullBm ? null : bmId,
      bm_name:      bmName,
      access_token: tokenToUse!,
      account_id:   r.account_id,
      name:         r.name ?? `Conta ${r.account_id}`,
      currency:     r.currency === "USD" ? "USD" : "BRL",
      is_active:    true,
      updated_at:   now,
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
    const q3 = supabase.from("ad_accounts").update(updates);
    const { error: updateError } = await (isNullBm ? q3.is("bm_id", null) : q3.eq("bm_id", bmId));
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  // 3. Remover contas marcadas para exclusão
  if (accountsToRemove.length > 0) {
    const q4 = supabase.from("ad_accounts").delete().in("id", accountsToRemove);
    const { error: removeError } = await (isNullBm ? q4.is("bm_id", null) : q4.eq("bm_id", bmId));
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
  const isNullBm = bmId === "sem-bm";

  const q = supabase.from("ad_accounts").delete();
  const { data: deleted, error } = await (isNullBm ? q.is("bm_id", null) : q.eq("bm_id", bmId)).select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true, accounts_removed: deleted?.length ?? 0 });
}
