"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import type { PayafterDashboardData } from "@/types";

interface PayafterTrendChartsProps {
  daily: PayafterDashboardData["daily"];
  weeklyPaymentRate: PayafterDashboardData["weeklyPaymentRate"];
}

export function PayafterTrendCharts({ daily, weeklyPaymentRate }: PayafterTrendChartsProps) {
  const dailyChart = daily.map((x) => ({
    ...x,
    label: x.date.slice(8, 10) + "/" + x.date.slice(5, 7),
  }));

  const weeklyChart = weeklyPaymentRate.map((w) => ({
    ...w,
    belowMeta: w.taxa < 80 ? w.taxa : 80,
    aboveMeta: w.taxa >= 80 ? w.taxa : null,
  }));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold">Agendamentos por dia</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dailyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              name="Agendamentos"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold">Taxa de Pagamento por semana</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={weeklyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`} />
            <ReferenceLine y={80} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: "Meta 80%", fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="belowMeta"
              fill="#fecaca"
              stroke="none"
              fillOpacity={0.4}
              name="Abaixo da meta"
            />
            <Line
              type="monotone"
              dataKey="taxa"
              name="Taxa pagamento"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
