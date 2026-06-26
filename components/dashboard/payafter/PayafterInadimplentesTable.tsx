"use client";

import { Download } from "lucide-react";
import { formatCurrency, formatDatetime } from "@/lib/utils";
import type { PayafterInadimplenteRow } from "@/types";

interface PayafterInadimplentesTableProps {
  rows: PayafterInadimplenteRow[];
  loading?: boolean;
}

function exportCsv(rows: PayafterInadimplenteRow[]) {
  const headers = [
    "Codigo",
    "Cliente",
    "CPF",
    "Telefone",
    "Valor",
    "Vendedor",
    "Estado",
    "Data",
  ];
  const lines = rows.map((r) =>
    [
      r.orderNumber,
      r.customerName,
      r.customerCpf,
      r.customerPhone,
      r.value.toFixed(2),
      r.sellerName,
      r.state,
      r.createdAt,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inadimplentes-payafter-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PayafterInadimplentesTable({ rows, loading }: PayafterInadimplentesTableProps) {
  const totalValor = rows.reduce((s, r) => s + r.value, 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-6 w-56 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      id="inadimplentes-section"
      className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold">Inadimplentes Confirmados</h3>
          <p className="text-xs text-gray-500">
            {rows.length} pedidos · {formatCurrency(totalValor)} total
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(rows)}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">Nenhum inadimplente no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-left text-xs text-gray-400">
                <th className="px-5 py-3">#Código</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">CPF</th>
                <th className="px-5 py-3">Telefone</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3">Vendedor</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs">#{row.orderNumber}</td>
                  <td className="px-5 py-3">{row.customerName}</td>
                  <td className="px-5 py-3 text-gray-500">{row.customerCpf || "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{row.customerPhone || "—"}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatCurrency(row.value)}</td>
                  <td className="px-5 py-3 text-gray-500">{row.sellerName}</td>
                  <td className="px-5 py-3 text-gray-500">{row.state}</td>
                  <td className="px-5 py-3 text-gray-400">{formatDatetime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
