"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AgendamentosChart } from "@/components/dashboard/AgendamentosChart";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import { formatPercent } from "@/lib/utils";
import type { AgendamentosExpanded } from "@/types";

export default function AgendamentosPage() {
  const data = useFetchOnFilters<AgendamentosExpanded>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/agendamentos?${params}`, { signal });
    if (!res.ok) throw new Error("Falha ao carregar agendamentos");
    return res.json();
  });

  if (data.loading) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="mx-auto max-w-[1000px] rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        {data.error}
      </div>
    );
  }

  const d = data.data;
  if (!d) return null;

  const dailyChart = d.daily.map((x) => ({
    ...x,
    label: x.date.slice(8, 10) + "/" + x.date.slice(5, 7),
  }));

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total no período" value={String(d.total)} sub={formatPercent(d.variationPct)} />
        <StatCard label="Antecipado" value={String(d.antecipado)} />
        <StatCard label="PayAfter" value={String(d.payafter)} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <p className="text-sm text-gray-500">
          Taxa de comparecimento:{" "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {d.taxaComparecimento.toFixed(1)}%
          </span>
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold">Agendamentos por dia</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dailyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Agendamentos" stroke="#6366f1" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <AgendamentosChart data={d.bySeller} loading={false} />
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
