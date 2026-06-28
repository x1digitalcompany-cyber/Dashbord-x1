"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { PagamentosTable } from "@/components/dashboard/PagamentosTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import { formatCurrency } from "@/lib/utils";
import type { PagamentosExpanded, PagarmePaymentStats, PaytBraipPaymentStats } from "@/types";

const GATEWAY_COLORS = ["#6366f1", "#f59e0b", "#10b981"];

function gatewaySummary(stats: PagarmePaymentStats | PaytBraipPaymentStats, isPagarme: boolean) {
  const estornosValor = isPagarme
    ? (stats as PagarmePaymentStats).estornos_valor
    : (stats as PaytBraipPaymentStats).reembolsos_valor;
  const estornosCount = isPagarme
    ? (stats as PagarmePaymentStats).estornos_count
    : (stats as PaytBraipPaymentStats).reembolsos_count;
  return {
    valor: stats.aprovados_valor + stats.pendentes_valor + estornosValor,
    transacoes: stats.aprovados_count + stats.pendentes_count + estornosCount,
  };
}

export default function PagamentosPage() {
  const data = useFetchOnFilters<PagamentosExpanded>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/payments?${params}&expanded=1`, {
      signal,
    });
    if (!res.ok) throw new Error("Falha ao carregar pagamentos");
    return res.json();
  });

  if (data.loading) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-3 gap-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
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

  const gateways = [
    { key: "pagarme", label: "Pagar.me", ...gatewaySummary(d.pagarme, true) },
    { key: "payt", label: "Payt", ...gatewaySummary(d.payt, false) },
    { key: "braip", label: "Braip", ...gatewaySummary(d.braip, false) },
  ];

  const pieData = gateways
    .filter((g) => g.valor > 0)
    .map((g) => ({ name: g.label, value: g.valor }));

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Total consolidado
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(d.total.valor)}
        </p>
        <p className="text-sm text-gray-500">{d.total.transacoes} transações</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {gateways.map((g) => (
          <div
            key={g.key}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
          >
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{g.label}</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(g.valor)}</p>
            <p className="text-xs text-gray-400">{g.transacoes} transações</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PagamentosTable data={d} loading={false} />

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-sm font-semibold">Distribuição por gateway</h3>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={GATEWAY_COLORS[i % GATEWAY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">Sem dados no período.</p>
          )}
        </div>
      </div>
    </div>
  );
}
