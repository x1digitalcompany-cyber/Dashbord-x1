import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(searchParams.get("to") ?? Date.now());

  try {
    const data = await fetchMetaAdsInsights(from, to);

    if (data.error && data.spend === 0 && !data.campaigns.length) {
      return NextResponse.json(
        { error: data.error, ...data },
        { status: data.error.includes("Token") ? 401 : 503 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar Meta Ads";
    const status = /token|expirado|inválido/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
