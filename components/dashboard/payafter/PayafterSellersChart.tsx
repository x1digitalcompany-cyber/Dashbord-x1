"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { PayafterSellerExpanded } from "@/types";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

interface PayafterSellersChartProps {
  data: PayafterSellerExpanded[];
  loading?: boolean;
}

export function PayafterSellersChart({ data, loading }: PayafterSellersChartProps) {
  if (loading) return <ChartSkeleton />;

  const sorted = [...data];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Agendamentos por Vendedor</CardTitle>
        <p className="text-xs text-gray-400">Ordenado por pedidos convertidos</p>
      </CardHeader>
      <CardContent className="flex-1">
        <ResponsiveContainer width="100%" height={Math.max(260, sorted.length * 48)}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="sellerName"
              width={110}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as PayafterSellerExpanded;
                return (
                  <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm shadow-lg">
                    <p className="font-semibold">{item.sellerName}</p>
                    <p>{item.agendamentos} agendamentos</p>
                    <p className="text-emerald-600">{item.convertidos} convertidos ({item.taxaConversao.toFixed(1)}%)</p>
                    <p className="text-red-500">Inadimplência: {item.taxaInadimplencia.toFixed(1)}%</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="convertidos" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {sorted.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          {sorted.slice(0, 8).map((s) => (
            <div key={s.sellerId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-700">{s.sellerName}</span>
              <span className="text-gray-500">
                {s.convertidos} pedidos · conv. {s.taxaConversao.toFixed(0)}% · inad. {s.taxaInadimplencia.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
