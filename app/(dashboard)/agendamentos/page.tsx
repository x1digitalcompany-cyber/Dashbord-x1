"use client";

import { useCallback, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { PayafterAlerts } from "@/components/dashboard/payafter/PayafterAlerts";
import { PayafterKpiCards } from "@/components/dashboard/payafter/PayafterKpiCards";
import { PayafterFunnel } from "@/components/dashboard/payafter/PayafterFunnel";
import { PayafterEmRiscoTable } from "@/components/dashboard/payafter/PayafterEmRiscoTable";
import { PayafterTrendCharts } from "@/components/dashboard/payafter/PayafterTrendCharts";
import { PayafterSellersChart } from "@/components/dashboard/payafter/PayafterSellersChart";
import { PayafterInadimplentesTable } from "@/components/dashboard/payafter/PayafterInadimplentesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters, useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { formatPercent } from "@/lib/utils";
import type {
  AgendamentosExpanded,
  PayafterAlert,
  PayafterDashboardData,
  PayafterEmRiscoRow,
  PayafterFunnelStep,
} from "@/types";

export default function AgendamentosPage() {
  const { refresh } = useDashboardFilters();
  const [emRiscoRefresh, setEmRiscoRefresh] = useState(0);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const emRiscoRef = useRef<HTMLDivElement>(null);
  const inadimplentesRef = useRef<HTMLDivElement>(null);

  const legacy = useFetchOnFilters<AgendamentosExpanded>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/agendamentos?${params}`, { signal });
    if (!res.ok) throw new Error("Falha ao carregar agendamentos");
    return res.json();
  });

  const payafter = useFetchOnFilters<PayafterDashboardData>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/agendamentos-payafter?${params}`, { signal });
    if (!res.ok) throw new Error("Falha ao carregar dados PayAfter");
    return res.json();
  });

  const emRisco = useFetchOnFilters<PayafterEmRiscoRow[]>(
    async (params, signal) => {
      const res = await fetch(`/api/dashboard/em-risco?${params}`, { signal });
      if (!res.ok) throw new Error("Falha ao carregar pedidos em risco");
      return res.json();
    },
    [emRiscoRefresh]
  );

  const handleEmRiscoUpdated = useCallback(() => {
    setEmRiscoRefresh((k) => k + 1);
    refresh();
  }, [refresh]);

  const handleAlertClick = (alert: PayafterAlert) => {
    if (alert.orderIds?.length) {
      setHighlightIds(new Set(alert.orderIds));
      setTimeout(() => setHighlightIds(new Set()), 5000);
    }
    const target =
      alert.target === "em-risco" ? emRiscoRef.current : inadimplentesRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFunnelClick = (step: PayafterFunnelStep) => {
    if (step.id === "em_risco" || step.id === "entregues") {
      emRiscoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (step.id === "inadimplentes") {
      inadimplentesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* SEÇÃO 1 — Alertas */}
      {payafter.loading ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : payafter.data?.alerts.length ? (
        <PayafterAlerts alerts={payafter.data.alerts} onAlertClick={handleAlertClick} />
      ) : null}

      {/* SEÇÃO 2 — KPIs PayAfter */}
      {payafter.loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 min-w-[160px] rounded-2xl" />
          ))}
        </div>
      ) : payafter.data ? (
        <PayafterKpiCards kpis={payafter.data.kpis} />
      ) : null}

      {/* SEÇÃO 3 — Funil */}
      {payafter.loading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : payafter.data ? (
        <PayafterFunnel steps={payafter.data.funnel} onStepClick={handleFunnelClick} />
      ) : null}

      {/* SEÇÃO 5 — Em Risco */}
      <div ref={emRiscoRef}>
        <PayafterEmRiscoTable
          rows={emRisco.data ?? []}
          loading={emRisco.loading}
          highlightIds={highlightIds}
          onUpdated={handleEmRiscoUpdated}
        />
      </div>

      {/* SEÇÃO 6 — Tendências */}
      {payafter.loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : payafter.data ? (
        <PayafterTrendCharts
          daily={payafter.data.daily}
          weeklyPaymentRate={payafter.data.weeklyPaymentRate}
        />
      ) : null}

      {/* Conteúdo existente — mantido */}
      {legacy.loading ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </>
      ) : legacy.error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
          {legacy.error}
        </div>
      ) : legacy.data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total no período"
              value={String(legacy.data.total)}
              sub={formatPercent(legacy.data.variationPct)}
            />
            <StatCard label="Antecipado" value={String(legacy.data.antecipado)} />
            <StatCard label="PayAfter" value={String(legacy.data.payafter)} />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <p className="text-sm text-gray-500">
              Taxa de comparecimento:{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {legacy.data.taxaComparecimento.toFixed(1)}%
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h3 className="mb-4 text-sm font-semibold">Agendamentos por dia</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={legacy.data.daily.map((x) => ({
                  ...x,
                  label: x.date.slice(8, 10) + "/" + x.date.slice(5, 7),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Agendamentos"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}

      {/* SEÇÃO 4 — Vendedores expandido */}
      {payafter.loading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : payafter.data ? (
        <PayafterSellersChart data={payafter.data.sellers} />
      ) : null}

      {/* SEÇÃO 7 — Inadimplentes */}
      <div ref={inadimplentesRef}>
        <PayafterInadimplentesTable
          rows={payafter.data?.inadimplentes ?? []}
          loading={payafter.loading}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-emerald-600">{sub}</p>}
    </div>
  );
}
