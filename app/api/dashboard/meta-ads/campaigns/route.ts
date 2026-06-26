import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAdsCampaigns } from "@/lib/api/meta-ads";
import { parseFromToParams } from "@/lib/period";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);

  try {
    const campaigns = await fetchMetaAdsCampaigns(from, to);
    return NextResponse.json(campaigns);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar campanhas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
