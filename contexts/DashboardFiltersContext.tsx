"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadSavedFilters } from "@/components/dashboard/FilterBar";
import type { GlobalFilters } from "@/types";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

function getDateRangeForPeriod(period: GlobalFilters["period"]) {
  const to = new Date();
  const from = new Date();
  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

function buildInitialFilters(): GlobalFilters {
  const saved = loadSavedFilters();
  const period = (saved.period as GlobalFilters["period"]) ?? "30d";
  return {
    period,
    dateRange: getDateRangeForPeriod(period),
    sellerIds: saved.sellerIds ?? [],
  };
}

interface DashboardFiltersContextValue {
  filters: GlobalFilters;
  setFilters: (filters: GlobalFilters) => void;
  refresh: () => void;
  isRefreshing: boolean;
  refreshKey: number;
}

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(
  null
);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(buildInitialFilters);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <DashboardFiltersContext.Provider
      value={{ filters, setFilters, refresh, isRefreshing, refreshKey }}
    >
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx) {
    throw new Error("useDashboardFilters must be used within DashboardFiltersProvider");
  }
  return ctx;
}

export function buildApiParams(filters: GlobalFilters) {
  return new URLSearchParams({
    from: filters.dateRange.from.toISOString(),
    to: filters.dateRange.to.toISOString(),
    ...(filters.sellerIds.length > 0
      ? { sellerIds: filters.sellerIds.join(",") }
      : {}),
  });
}

export function useFetchOnFilters<T>(
  fetcher: (params: URLSearchParams, signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
) {
  const { filters, refreshKey } = useDashboardFilters();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(undefined);

    const params = buildApiParams(filters);
    fetcher(params, ctrl.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Falha ao carregar dados");
        setLoading(false);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, refreshKey, ...deps]);

  return { data, loading, error };
}
