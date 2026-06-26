"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import { MetaAdsKpiCards } from "@/components/dashboard/meta-ads/MetaAdsKpiCards";
import { MetaAdsCharts } from "@/components/dashboard/meta-ads/MetaAdsCharts";
import { MetaAdsFunnel } from "@/components/dashboard/meta-ads/MetaAdsFunnel";
import { MetaAdsCampaignsTable } from "@/components/dashboard/meta-ads/MetaAdsCampaignsTable";
import { MetaAdsNotConfigured } from "@/components/dashboard/meta-ads/MetaAdsNotConfigured";
import type { MetaAdsData } from "@/lib/api/meta-ads";

interface FunnelResponse {
  funnel: Array<{ id: string; label: string; count: number; conversionPct: number }>;
  metaConfigured: boolean;
}

export default function AnunciosPage() {
  const meta = useFetchOnFilters<MetaAdsData>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/meta-ads?${params}`, { signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Falha ao carregar Meta Ads");
    }
    return res.json();
  });

  const funnel = useFetchOnFilters<FunnelResponse>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/meta-ads/funnel?${params}`, { signal });
    if (!res.ok) throw new Error("Falha ao carregar funil");
    return res.json();
  });

  const d = meta.data;
  const notConfigured = d?.mock === true;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Anúncios Meta</h1>
        <p className="text-sm text-gray-500">Performance das campanhas Facebook / Instagram</p>
      </div>

      {notConfigured && <MetaAdsNotConfigured />}

      {meta.loading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : d && !notConfigured ? (
        <MetaAdsKpiCards data={d} />
      ) : null}

      {meta.loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : d && !notConfigured ? (
        <MetaAdsCharts daily={d.daily} />
      ) : null}

      {funnel.loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : funnel.data ? (
        <MetaAdsFunnel steps={funnel.data.funnel} />
      ) : null}

      {meta.loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : d && !notConfigured ? (
        <MetaAdsCampaignsTable campaigns={d.campaigns} />
      ) : null}

      {meta.error && !notConfigured && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {meta.error}
        </div>
      )}
    </div>
  );
}
