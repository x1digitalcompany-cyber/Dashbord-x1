"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BrazilMap } from "@/components/dashboard/BrazilMap";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { EstadoMetric } from "@/types";

interface StateMapsSectionProps {
  data: EstadoMetric[] | null;
  loading?: boolean;
  error?: string;
}

export function StateMapsSection({ data, loading, error }: StateMapsSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Skeleton className="h-[500px] rounded-2xl" />
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* Mapa 1 — Vendas por estado */}
      <BrazilMap
        data={rows.map((e) => ({ uf: e.uf, value: e.vendas, label: e.uf }))}
        colorScale="purple"
        title="Vendas por Estado"
        tooltipFormatter={(uf, value) => {
          const e = rows.find((r) => r.uf === uf);
          return `${uf}: ${formatNumber(value)} vendas — ${formatCurrency(e?.faturamento ?? 0)}`;
        }}
      />

      {/* Mapa 2 — Inadimplência por estado */}
      <BrazilMap
        data={rows.map((e) => ({ uf: e.uf, value: e.taxa_inadimplencia, label: e.uf }))}
        colorScale="red"
        title="Inadimplência por Estado (%)"
        tooltipFormatter={(uf, value) => {
          const e = rows.find((r) => r.uf === uf);
          return `${uf}: ${value.toFixed(1)}% inadimplência — ${formatNumber(e?.inadimplentes ?? 0)} pedidos`;
        }}
      />
    </div>
  );
}
