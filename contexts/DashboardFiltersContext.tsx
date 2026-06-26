"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildApiParams,
  buildInitialFilters,
  filtersDependencyKey,
  getDateRangeForPeriod,
  saveFiltersToStorage,
} from "@/lib/period";
import type { GlobalFilters, PeriodOption } from "@/types";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface DashboardFiltersContextValue {
  filters: GlobalFilters;
  setFilters: (filters: GlobalFilters) => void;
  period: PeriodOption;
  from: Date;
  to: Date;
  sellerName: string | null;
  setPeriod: (period: PeriodOption, custom?: { from: string; to: string }) => void;
  setSellerName: (name: string | null) => void;
  refresh: () => void;
  isRefreshing: boolean;
  refreshKey: number;
}

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(
  null
);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(buildInitialFilters);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const setFilters = useCallback((next: GlobalFilters) => {
    saveFiltersToStorage(next);
    setFiltersState(next);
  }, []);

  const setPeriod = useCallback(
    (period: PeriodOption, custom?: { from: string; to: string }) => {
      setFiltersState((prev) => {
        const customFrom = period === "custom" ? custom?.from ?? prev.customFrom : undefined;
        const customTo = period === "custom" ? custom?.to ?? prev.customTo : undefined;
        const dateRange = getDateRangeForPeriod(
          period,
          customFrom && customTo ? { from: customFrom, to: customTo } : undefined
        );
        const next: GlobalFilters = {
          ...prev,
          period,
          dateRange,
          customFrom,
          customTo,
        };
        saveFiltersToStorage(next);
        return next;
      });
    },
    []
  );

  const setSellerName = useCallback((name: string | null) => {
    setFiltersState((prev) => {
      const next = { ...prev, sellerName: name };
      saveFiltersToStorage(next);
      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      period: filters.period,
      from: filters.dateRange.from,
      to: filters.dateRange.to,
      sellerName: filters.sellerName,
      setPeriod,
      setSellerName,
      refresh,
      isRefreshing,
      refreshKey,
    }),
    [filters, setFilters, setPeriod, setSellerName, refresh, isRefreshing, refreshKey]
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
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

export { buildApiParams } from "@/lib/period";

export function useFetchOnFilters<T>(
  fetcher: (params: URLSearchParams, signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
) {
  const { filters, refreshKey } = useDashboardFilters();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const filterKey = filtersDependencyKey(filters);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(undefined);

    const params = buildApiParams(filters);
    fetcher(params, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError" || ctrl.signal.aborted) return;
        setError(err.message || "Falha ao carregar dados");
        setLoading(false);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, refreshKey, ...deps]);

  return { data, loading, error };
}
