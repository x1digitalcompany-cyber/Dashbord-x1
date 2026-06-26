import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { supabase } from "@/lib/supabase";
import { fetchMetaAccountInfo } from "@/lib/meta-account";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ad_accounts")
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await supabase.from("ad_accounts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { data: account, error } = await supabase
    .from("ad_accounts")
    .select("id, account_id, access_token, name")
    .eq("id", id)
    .maybeSingle();

  if (error || !account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const info = await fetchMetaAccountInfo(account.account_id, account.access_token);
  return NextResponse.json({
    id: account.id,
    accountId: account.account_id,
    name: account.name,
    status: info.error ? "error" : "ok",
    metaName: info.name,
    accountStatus: info.accountStatus,
    error: info.error,
  });
}
