"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BrazilChoroplethMap } from "@/components/dashboard/BrazilChoroplethMap";
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
      <BrazilChoroplethMap
        data={rows}
        mode="vendas"
        title="Vendas por Estado"
      />
      <BrazilChoroplethMap
        data={rows}
        mode="inadimplencia"
        title="Inadimplência por Estado"
      />
    </div>
  );
}
