"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KanbanFive } from "@/components/dashboard/KanbanFive";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { moveKanbanOrder } from "@/lib/api/kanban";
import type {
  KanbanApiResponse,
  KanbanColumn,
  KanbanColumns,
  KanbanMetrics,
  KanbanOperationType,
} from "@/types";

const TABS: { id: KanbanOperationType; label: string }[] = [
  { id: "antecipado", label: "Antecipado" },
  { id: "agendado", label: "Agendado" },
];

const EMPTY_COLUMNS: KanbanColumns = {
  pedidos_criados: [],
  em_transito: [],
  retirar_correios: [],
  pagos: [],
  devolvidos: [],
  inadimplentes: [],
};

const EMPTY_METRICS: KanbanMetrics = {
  total: 0,
  paidValue: 0,
  inadimplentesCount: 0,
};

function useKanbanTipo(tipo: KanbanOperationType) {
  const [data, setData] = useState<KanbanColumns | null>(null);
  const [metrics, setMetrics] = useState<KanbanMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/dashboard/kanban?tipo=${tipo}`, { signal });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      const json = (await res.json()) as KanbanApiResponse;
      setData(json.columns ?? json);
      setMetrics(json.metrics ?? EMPTY_METRICS);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Falha ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return { data, metrics, loading, error, reload: load };
}

export default function KanbanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const activeTab: KanbanOperationType =
    tipoParam === "agendado" ? "agendado" : "antecipado";

  const antecipado = useKanbanTipo("antecipado");
  const agendado = useKanbanTipo("agendado");

  const active = activeTab === "antecipado" ? antecipado : agendado;

  const setTab = (tab: KanbanOperationType) => {
    router.replace(`/kanban?tipo=${tab}`, { scroll: false });
  };

  const handleMove = (orderId: string, newColumn: KanbanColumn) =>
    moveKanbanOrder(orderId, newColumn).then(() => active.reload());

  const tabCount = (tab: KanbanOperationType) => {
    const m = tab === "antecipado" ? antecipado.metrics : agendado.metrics;
    return m.total;
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-950">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-900"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === tab.id
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800"
              )}
            >
              {tabCount(tab.id)}
            </span>
          </button>
        ))}
      </div>

      {!active.loading && !active.error && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Total de pedidos" value={formatNumber(active.metrics.total)} />
          <MetricCard
            label="Valor dos pagos"
            value={formatCurrency(active.metrics.paidValue)}
          />
          <MetricCard
            label="Inadimplentes"
            value={formatNumber(active.metrics.inadimplentesCount)}
          />
        </div>
      )}

      {activeTab === "antecipado" ? (
        <KanbanFive
          title="Kanban Five — Antecipado"
          data={antecipado.data}
          loading={antecipado.loading}
          error={antecipado.error}
          onMove={handleMove}
        />
      ) : (
        <KanbanFive
          title="Kanban Five — Agendado"
          data={agendado.data}
          loading={agendado.loading}
          error={agendado.error}
          onMove={handleMove}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
