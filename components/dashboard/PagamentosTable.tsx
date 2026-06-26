"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PaymentRow, PaymentGateway, PaymentStatus } from "@/types";

interface PagamentosTableProps {
  data: PaymentRow[] | null;
  loading?: boolean;
  error?: string;
}

const LABELS: Record<PaymentGateway, Record<PaymentStatus, string>> = {
  pagarme: {
    approved: "Pagar.me — Aprovados",
    pending: "Pagar.me — Pendentes",
    refunded: "Pagar.me — Estornos",
    chargeback: "Pagar.me — Chargeback",
  },
  payt: {
    approved: "Payt — Aprovados",
    pending: "Payt — Pendentes",
    refunded: "Payt — Estornos",
    chargeback: "Payt — Chargeback",
  },
  five: {
    approved: "Five — Pagos",
    pending: "Five — Pendentes",
    refunded: "Five — Devolvidos",
    chargeback: "Five — Inadimplentes",
  },
  braip: {
    approved: "Braip — Aprovados",
    pending: "Braip — Pendentes",
    refunded: "Braip — Estornos",
    chargeback: "Braip — Chargeback",
  },
};

const STATUS_BADGE: Record<PaymentStatus, "green" | "yellow" | "red" | "blue" | "rose"> = {
  approved: "green",
  pending: "yellow",
  refunded: "red",
  chargeback: "rose",
};

const GATEWAY_ORDER: Array<{ gateway: PaymentGateway; status: PaymentStatus }> = [
  { gateway: "pagarme", status: "approved" },
  { gateway: "pagarme", status: "pending" },
  { gateway: "pagarme", status: "refunded" },
  { gateway: "payt", status: "approved" },
  { gateway: "payt", status: "pending" },
  { gateway: "five", status: "approved" },
  { gateway: "five", status: "pending" },
  { gateway: "five", status: "chargeback" },
];

export function PagamentosTable({ data, loading, error }: PagamentosTableProps) {
  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Breakdown de Pagamentos</CardTitle>
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

  const getRow = (gateway: PaymentGateway, status: PaymentStatus): PaymentRow | null => {
    return data?.find((r) => r.gateway === gateway && r.status === status) ?? null;
  };

  const totalVolume = data?.reduce((acc, r) => acc + r.volume, 0) ?? 0;
  const totalCount = data?.reduce((acc, r) => acc + r.count, 0) ?? 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Breakdown de Pagamentos</CardTitle>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(totalVolume)}
          </p>
          <p className="text-xs text-gray-400">{formatNumber(totalCount)} transações</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left pb-3 font-medium">Gateway / Status</th>
              <th className="text-right pb-3 font-medium">Volume</th>
              <th className="text-right pb-3 font-medium">Qtd.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {GATEWAY_ORDER.map(({ gateway, status }) => {
              const row = getRow(gateway, status);
              if (!row) return null;
              return (
                <tr key={`${gateway}-${status}`} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_BADGE[status]}>
                        {status === "approved"
                          ? "Aprovado"
                          : status === "pending"
                          ? "Pendente"
                          : status === "refunded"
                          ? "Estorno"
                          : "Chargeback"}
                      </Badge>
                      <span className="text-gray-600">
                        {LABELS[gateway][status]}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-900 tabular-nums">
                    {formatCurrency(row.volume)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 tabular-nums">
                    {formatNumber(row.count)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 text-sm font-semibold">
              <td className="pt-3 text-gray-500">Total</td>
              <td className="pt-3 text-right text-gray-900 tabular-nums">
                {formatCurrency(totalVolume)}
              </td>
              <td className="pt-3 text-right text-gray-700 tabular-nums">
                {formatNumber(totalCount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
