"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Megaphone,
  Wallet,
  ShoppingBag,
  Receipt,
  Target,
  Users,
  Percent,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceiroData } from "@/types";

interface FinanceKpiGridProps {
  data: FinanceiroData | null;
  loading?: boolean;
  error?: string;
}

interface KpiDef {
  key: keyof FinanceiroData["current"];
  label: string;
  icon: React.ElementType;
  format: (v: number) => string;
  highlight?: (v: number, data: FinanceiroData["current"]) => string;
  skip?: boolean;
}

const KPIS: KpiDef[] = [
  {
    key: "faturamentoTotal",
    label: "Faturamento Total",
    icon: DollarSign,
    format: formatCurrency,
    highlight: (_, d) => (d.roas > 3 ? "text-emerald-600" : "text-gray-900"),
  },
  {
    key: "gastoAnuncios",
    label: "Gasto com Anúncios",
    icon: Megaphone,
    format: formatCurrency,
  },
  {
    key: "lucroLiquido",
    label: "Lucro Líquido",
    icon: Wallet,
    format: formatCurrency,
    highlight: (v) => (v >= 0 ? "text-emerald-600" : "text-red-600"),
  },
  {
    key: "totalVendas",
    label: "Total de Vendas",
    icon: ShoppingBag,
    format: formatNumber,
  },
  {
    key: "ticketMedio",
    label: "Ticket Médio",
    icon: Receipt,
    format: formatCurrency,
  },
  {
    key: "roas",
    label: "ROAS",
    icon: Target,
    format: (v) => `${v.toFixed(2)}x`,
    highlight: (v) => (v > 3 ? "text-emerald-600" : "text-gray-900"),
  },
  {
    key: "leadsAtendidos",
    label: "Leads Atendidos",
    icon: Users,
    format: formatNumber,
  },
  {
    key: "taxaConversao",
    label: "Taxa de Conversão",
    icon: Percent,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "cpaMedio",
    label: "CPA Médio",
    icon: BarChart3,
    format: formatCurrency,
  },
  {
    key: "inadimplenciaTotal",
    label: "Inadimplência Total",
    icon: AlertTriangle,
    format: formatCurrency,
  },
  {
    key: "taxaInadimplencia",
    label: "Taxa de Inadimplência",
    icon: Percent,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "leadsPorVenda",
    label: "Leads por Venda",
    icon: Users,
    format: (v) => v.toFixed(2),
    skip: false,
  },
];

function VariationBadge({ pct }: { pct?: number }) {
  if (pct == null || Number.isNaN(pct)) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-emerald-600" : "text-red-500"
      )}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {formatPercent(pct)}
    </span>
  );
}

export function FinanceKpiGrid({ data, loading, error }: FinanceKpiGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
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

  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.metaAdsError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Meta Ads:</strong> {data.metaAdsError}{" "}
          <a href="/configuracoes" className="font-medium underline">
            Configurar em Configurações
          </a>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.filter((k) => !k.skip).map(({ key, label, icon: Icon, format, highlight }) => {
          const value = data.current[key] as number;
          const variation = data.variations[key];
          const colorClass = highlight?.(value, data.current) ?? "text-gray-900 dark:text-gray-100";

          return (
            <div
              key={key}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {label}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
                  <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tracking-tight", colorClass)}>
                {format(value)}
              </p>
              <div className="mt-2">
                <VariationBadge pct={variation} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
