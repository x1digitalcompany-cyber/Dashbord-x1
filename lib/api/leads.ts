// X1 Track Pro — via KPI route (leads count + CPL já calculado)
export interface LeadsMetrics {
  total: number;
  cpl: number;
  variationPct: number;
}

// Leads são retornados junto com o endpoint /api/dashboard/kpi
// Esta função é usada apenas como fallback documentado
export async function fetchLeadsMetrics(_from: Date, _to: Date): Promise<LeadsMetrics> {
  return { total: 0, cpl: 0, variationPct: 0 };
}
