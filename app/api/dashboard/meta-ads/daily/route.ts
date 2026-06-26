import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsDailyInsights } from "@/lib/api/meta-ads";
import { parseFromToParams } from "@/lib/period";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);

  try {
    const daily = await fetchMetaAdsDailyInsights(from, to);
    return NextResponse.json(daily);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar série diária";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
