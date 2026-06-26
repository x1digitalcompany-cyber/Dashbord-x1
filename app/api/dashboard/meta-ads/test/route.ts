import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getMetaApiVersion, normalizeAccountId, testMetaAdsConnection } from "@/lib/meta-account";

export async function GET(req: NextRequest) {
  const token = await requireSession(req);
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const accountId = normalizeAccountId(String(searchParams.get("account_id") ?? ""));
  const accessToken = String(searchParams.get("access_token") ?? "").trim();
  const apiVersion =
    searchParams.get("api_version")?.trim() || (await getMetaApiVersion());

  if (!accountId || !accessToken) {
    return NextResponse.json(
      { ok: false, error: "account_id e access_token são obrigatórios." },
      { status: 400 }
    );
  }

  const result = await testMetaAdsConnection(accountId, accessToken, apiVersion);
  return NextResponse.json(result);
}
