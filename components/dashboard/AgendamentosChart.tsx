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
import { AlertCircle } from "lucide-react";
import type { SellerAgendamento } from "@/types";

interface AgendamentosChartProps {
  data: SellerAgendamento[] | null;
  loading?: boolean;
  error?: string;
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#ddd6fe",
];

export function AgendamentosChart({ data, loading, error }: AgendamentosChartProps) {
  if (loading) return <ChartSkeleton />;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = data
    ? [...data].sort((a, b) => b.agendamentos - a.agendamentos)
    : [];

  const total = sorted.reduce((acc, s) => acc + s.agendamentos, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload as SellerAgendamento;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-900">{item.sellerName}</p>
        <p className="text-indigo-600">{item.agendamentos} agendamentos</p>
        {item.meta && (
          <p className="text-gray-400 text-xs">Meta: {item.meta}</p>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Agendamentos por Vendedor</CardTitle>
        <span className="text-2xl font-bold text-gray-900 tabular-nums">
          {total}
        </span>
      </CardHeader>
      <CardContent className="flex-1">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="sellerName"
              width={100}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
            <Bar dataKey="agendamentos" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {sorted.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
          <span className="text-gray-400">Total geral</span>
          <span className="font-semibold text-gray-900">{total} agendamentos</span>
        </div>
      </CardContent>
    </Card>
  );
}
