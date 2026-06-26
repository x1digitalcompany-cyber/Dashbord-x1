"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KanbanFive } from "@/components/dashboard/KanbanFive";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { fetchKanbanBoard, moveKanbanOrder } from "@/lib/api/kanban";
import { computeKanbanMetrics } from "@/lib/kanban-utils";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type {
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

const KANBAN_REFRESH_MS = 30_000;

function useKanbanTipo(
  tipo: KanbanOperationType,
  sellerName: string | null
) {
  const [data, setData] = useState<KanbanColumns | null>(null);
  const [metrics, setMetrics] = useState<KanbanMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const json = await fetchKanbanBoard(tipo, sellerName, signal);
      setData(json.columns ?? EMPTY_COLUMNS);
      setMetrics(json.metrics ?? EMPTY_METRICS);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Falha ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [tipo, sellerName]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(), KANBAN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { data, metrics, loading, error, reload: load };
}

export default function KanbanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useDashboardFilters();
  const sellerName = filters.sellerName;

  const tipoFromUrl: KanbanOperationType =
    searchParams.get("tipo") === "agendado" ? "agendado" : "antecipado";

  const [activeTab, setActiveTab] = useState<KanbanOperationType>(tipoFromUrl);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setActiveTab(tipoFromUrl);
  }, [tipoFromUrl]);

  useEffect(() => {
    if (!searchParams.get("tipo")) {
      router.replace("/kanban?tipo=antecipado", { scroll: false });
    }
  }, [searchParams, router]);

  const antecipado = useKanbanTipo("antecipado", sellerName);
  const agendado = useKanbanTipo("agendado", sellerName);

  const active = activeTab === "antecipado" ? antecipado : agendado;

  const setTab = (tab: KanbanOperationType) => {
    setSearch("");
    setActiveTab(tab);
    router.replace(`/kanban?tipo=${tab}`, { scroll: false });
  };

  const handleMove = async (orderId: string, newColumn: KanbanColumn) => {
    await moveKanbanOrder(orderId, newColumn);
    await active.reload();
  };

  const tabCount = (tab: KanbanOperationType) => {
    const hook = tab === "antecipado" ? antecipado : agendado;
    return hook.metrics.total;
  };

  const displayMetrics = useMemo(() => {
    if (active.data) {
      return computeKanbanMetrics(active.data, search);
    }
    return active.metrics;
  }, [active.data, active.metrics, search]);

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
          <MetricCard label="Total de pedidos" value={formatNumber(displayMetrics.total)} />
          <MetricCard
            label="Valor dos pagos"
            value={formatCurrency(displayMetrics.paidValue)}
          />
          <MetricCard
            label="Inadimplentes"
            value={formatNumber(displayMetrics.inadimplentesCount)}
          />
        </div>
      )}

      <KanbanFive
        key={activeTab}
        title={activeTab === "antecipado" ? "Kanban Five — Antecipado" : "Kanban Five — Agendado"}
        data={active.data}
        loading={active.loading}
        error={active.error}
        search={search}
        onSearchChange={setSearch}
        onMove={handleMove}
      />
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
