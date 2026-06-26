"use client";

import Link from "next/link";
import { Megaphone, Users, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { MetaAdsData } from "@/lib/api/meta-ads";

export function MetaAdsSummaryRow() {
  const meta = useFetchOnFilters<MetaAdsData>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/meta-ads?${params}`, { signal });
    if (!res.ok) return { mock: true } as MetaAdsData;
    return res.json();
  });

  if (meta.loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const d = meta.data;
  const configured = d && !d.mock;

  const cards = [
    {
      label: "Gasto com Anúncio",
      icon: Megaphone,
      value: configured ? formatCurrency(d.spend) : "—",
      title: configured ? undefined : "Configure o Meta Ads nas configurações",
    },
    {
      label: "Quantidade de Leads",
      icon: Users,
      value: configured ? formatNumber(d.leads) : "—",
      title: configured ? undefined : "Configure o Meta Ads nas configurações",
    },
    {
      label: "CPL",
      icon: Target,
      value: configured && d.leads > 0 ? formatCurrency(d.cpl) : "—",
      title: configured ? undefined : "Configure o Meta Ads nas configurações",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Meta Ads</h2>
        <Link href="/anuncios" className="text-xs text-indigo-600 hover:underline">
          Ver anúncios →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, icon: Icon, value, title }) => (
          <div
            key={label}
            title={title}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {label}
              </span>
              <Icon size={16} className="text-indigo-500" />
            </div>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                configured ? "text-gray-900 dark:text-gray-100" : "text-gray-300"
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
