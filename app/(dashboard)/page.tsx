"use client";

import { DashboardFinanceGrid } from "@/components/dashboard/DashboardFinanceGrid";
import { FinanceCharts } from "@/components/dashboard/FinanceCharts";
import { StateMapsSection } from "@/components/dashboard/StateMapsSection";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import type { FinanceiroData, EstadoMetric } from "@/types";

export default function DashboardPage() {
  const financeiro = useFetchOnFilters<FinanceiroData>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/financeiro?${params}`, { signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Falha ao carregar métricas financeiras");
    }
    return res.json();
  });

  const porEstado = useFetchOnFilters<EstadoMetric[]>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/por-estado?${params}`, { signal });
    if (!res.ok) throw new Error("Falha ao carregar dados por estado");
    return res.json();
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <section>
        <DashboardFinanceGrid />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Evolução no Período
        </h2>
        <FinanceCharts
          data={financeiro.data}
          loading={financeiro.loading}
          error={financeiro.error}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Distribuição por Estado
        </h2>
        <StateMapsSection
          data={porEstado.data}
          loading={porEstado.loading}
          error={porEstado.error}
        />
      </section>
    </div>
  );
}
