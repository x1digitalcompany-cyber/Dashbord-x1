import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";
import { parseFromToParams } from "@/lib/period";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);

  try {
    const data = await fetchMetaAdsInsights(from, to);

    if (data.mock) {
      return NextResponse.json(data);
    }

    if (data.error && data.spend === 0 && !data.campaigns.length) {
      const status = /token|expirado/i.test(data.error) ? 401 : 503;
      return NextResponse.json(data, { status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar Meta Ads";
    const status = /token|expirado|inválido/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
