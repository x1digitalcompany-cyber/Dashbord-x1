"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PagamentosExpanded } from "@/types";

interface PagamentosTableProps {
  data: PagamentosExpanded | null;
  loading?: boolean;
  error?: string;
}

type TableRow = {
  label: string;
  volume: number;
  count: number;
  badge: "green" | "yellow" | "red";
};

function buildRows(data: PagamentosExpanded): TableRow[] {
  const { pagarme, payt, braip } = data;
  const rows: TableRow[] = [
    { label: "Pagar.me — Aprovados", volume: pagarme.aprovados_valor, count: pagarme.aprovados_count, badge: "green" },
    { label: "Pagar.me — Pendentes", volume: pagarme.pendentes_valor, count: pagarme.pendentes_count, badge: "yellow" },
    { label: "Pagar.me — Estornos", volume: pagarme.estornos_valor, count: pagarme.estornos_count, badge: "red" },
    { label: "Payt — Aprovados", volume: payt.aprovados_valor, count: payt.aprovados_count, badge: "green" },
    { label: "Payt — Pendentes", volume: payt.pendentes_valor, count: payt.pendentes_count, badge: "yellow" },
    { label: "Payt — Reembolsos", volume: payt.reembolsos_valor, count: payt.reembolsos_count, badge: "red" },
    { label: "Braip — Aprovados", volume: braip.aprovados_valor, count: braip.aprovados_count, badge: "green" },
    { label: "Braip — Pendentes", volume: braip.pendentes_valor, count: braip.pendentes_count, badge: "yellow" },
    { label: "Braip — Reembolsos", volume: braip.reembolsos_valor, count: braip.reembolsos_count, badge: "red" },
  ];
  return rows.filter((r) => r.count > 0 || r.volume > 0);
}

export function PagamentosTable({ data, loading, error }: PagamentosTableProps) {
  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Breakdown de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const rows = buildRows(data);
  const { total } = data;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Breakdown de Pagamentos</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-3 text-left font-medium">Gateway / Status</th>
              <th className="pb-3 text-right font-medium">Volume</th>
              <th className="pb-3 text-right font-medium">Qtd.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-400">
                  Sem dados no período.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label} className="transition-colors hover:bg-gray-50">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={row.badge}>
                        {row.badge === "green" ? "Aprovado" : row.badge === "yellow" ? "Pendente" : "Estorno"}
                      </Badge>
                      <span className="text-gray-600">{row.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-gray-900">
                    {formatCurrency(row.volume)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">
                    {formatNumber(row.count)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 text-sm font-semibold">
              <td className="pt-3 text-gray-500">Total</td>
              <td className="pt-3 text-right tabular-nums text-gray-900">
                {formatCurrency(total.valor)}
              </td>
              <td className="pt-3 text-right tabular-nums text-gray-700">
                {formatNumber(total.transacoes)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
