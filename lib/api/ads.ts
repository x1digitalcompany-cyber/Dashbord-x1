// X1 Track Pro — Meta Ads spend via KPI route
// Quando X1TRACKPRO_SUPABASE_URL estiver configurado, o endpoint /api/dashboard/kpi
// busca os ad_accounts do Supabase e chama Meta Graph API para calcular o spend
export interface AdsMetrics {
  totalSpend: number;
  variationPct: number;
}

export async function fetchAdsMetrics(_from: Date, _to: Date): Promise<AdsMetrics> {
  return { totalSpend: 0, variationPct: 0 };
}
