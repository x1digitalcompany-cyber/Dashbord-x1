"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { FinanceiroData } from "@/types";

interface FinanceChartsProps {
  data: FinanceiroData | null;
  loading?: boolean;
  error?: string;
}

function formatDay(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function FinanceCharts({ data, loading, error }: FinanceChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
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

  if (!data?.timeline?.length) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-950">
        Sem dados no período para exibir gráficos.
      </div>
    );
  }

  const chartData = data.timeline.map((p) => ({
    ...p,
    label: formatDay(p.date),
  }));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Faturamento vs Gasto com Anúncios
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v ?? 0))}
              labelFormatter={(l) => `Dia ${l}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="faturamento"
              name="Faturamento"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="gastoAnuncios"
              name="Gasto Anúncios"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Vendas por Dia
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(l) => `Dia ${l}`} />
            <Bar dataKey="vendas" name="Vendas" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
