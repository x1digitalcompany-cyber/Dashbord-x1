"use client";

import { useState } from "react";
import { moveKanbanOrder } from "@/lib/api/kanban";
import { cn, formatCurrency } from "@/lib/utils";
import type { PayafterEmRiscoRow } from "@/types";

interface PayafterEmRiscoTableProps {
  rows: PayafterEmRiscoRow[];
  loading?: boolean;
  highlightIds?: Set<string>;
  onUpdated: () => void;
}

function ConfirmModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-950">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-2 text-sm text-gray-500">Tem certeza?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export function PayafterEmRiscoTable({
  rows,
  loading,
  highlightIds,
  onUpdated,
}: PayafterEmRiscoTableProps) {
  const [pending, setPending] = useState<{
    orderId: string;
    column: "pagos" | "inadimplentes";
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(pending.orderId);
    try {
      await moveKanbanOrder(pending.orderId, pending.column);
      onUpdated();
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        id="em-risco-section"
        className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        <h3 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold dark:border-gray-800">
          ⚠️ Requer Ação — Entregues sem Pagamento
        </h3>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Nenhum pedido em risco no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs text-gray-400">
                  <th className="px-5 py-3">#Código</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Entregue há</th>
                  <th className="px-5 py-3">Vendedor</th>
                  <th className="px-5 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-gray-50 last:border-0",
                      row.urgency === "high" && "bg-red-50",
                      row.urgency === "medium" && "bg-amber-50",
                      highlightIds?.has(row.id) && "ring-2 ring-inset ring-indigo-300"
                    )}
                  >
                    <td className="px-5 py-3 font-mono text-xs">#{row.orderNumber}</td>
                    <td className="px-5 py-3">{row.customerName}</td>
                    <td className="px-5 py-3 text-gray-500">{row.customerPhone || "—"}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatCurrency(row.value)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "font-medium",
                          row.urgency === "high" && "text-red-600",
                          row.urgency === "medium" && "text-amber-600"
                        )}
                      >
                        {row.daysDelivered} dias
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{row.sellerName}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy === row.id}
                          onClick={() =>
                            setPending({
                              orderId: row.id,
                              column: "pagos",
                              label: "Marcar como Pago",
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Marcar como Pago
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.id}
                          onClick={() =>
                            setPending({
                              orderId: row.id,
                              column: "inadimplentes",
                              label: "Marcar Inadimplente",
                            })
                          }
                          className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Marcar Inadimplente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pending && (
        <ConfirmModal
          title={pending.label}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
