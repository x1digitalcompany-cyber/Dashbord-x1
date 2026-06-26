import type { SellerAgendamento } from "@/types";
import { MOCK_KPI, MOCK_SELLERS } from "@/mock/data";

export interface AgendamentosMetrics {
  total: number;
  conversionRate: number;
  variationPct: number;
}

export async function fetchAgendamentosMetrics(
  _from: Date,
  _to: Date
): Promise<AgendamentosMetrics> {
  // Metrics are included in the KPI route response
  return {
    total: MOCK_KPI.agendamentos.total,
    conversionRate: MOCK_KPI.agendamentos.conversionRate,
    variationPct: MOCK_KPI.agendamentos.variationPct,
  };
}

export async function fetchAgendamentosBySeller(
  from: Date,
  to: Date,
  sellerName?: string | null
): Promise<SellerAgendamento[]> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (sellerName) params.set("seller", sellerName);
  const res = await fetch(`/api/dashboard/sellers?${params}`);
  if (!res.ok) throw new Error("Falha ao buscar agendamentos por vendedor");
  return res.json();
}
