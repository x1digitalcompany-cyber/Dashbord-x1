"use client";

import { useState, useEffect } from "react";
import { Users, ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlobalFilters, PeriodOption } from "@/types";

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d",    label: "7 dias" },
  { value: "30d",   label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

function getDateRange(period: PeriodOption): { from: Date; to: Date } {
  const to   = new Date();
  const from = new Date();
  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 7);
  } else if (period === "30d") {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

interface SellerItem { id: string; name: string }

interface FilterBarProps {
  filters:     GlobalFilters;
  onChange:    (filters: GlobalFilters) => void;
  onRefresh:   () => void;
  isRefreshing?: boolean;
}

const LS_KEY = "dashboard-x1-filters";

function saveFilters(f: GlobalFilters) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ period: f.period, sellerName: f.sellerName })
    );
  } catch (_) {}
}

export function loadSavedFilters(): Partial<Pick<GlobalFilters, "period" | "sellerName">> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        period?: PeriodOption;
        sellerName?: string | null;
        sellerIds?: string[];
      };
      return {
        period: parsed.period,
        sellerName: parsed.sellerName ?? null,
      };
    }
  } catch (_) {}
  return {};
}

export function FilterBar({ filters, onChange, onRefresh, isRefreshing }: FilterBarProps) {
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellersList, setSellersList] = useState<SellerItem[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/sellers-list")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SellerItem[]) => setSellersList(data))
      .catch(() => {});
  }, []);

  const setPeriod = (period: PeriodOption) => {
    if (period === "custom") return;
    const next = { ...filters, period, dateRange: getDateRange(period) };
    saveFilters(next);
    onChange(next);
  };

  const selectSeller = (name: string | null) => {
    const next = { ...filters, sellerName: name };
    saveFilters(next);
    onChange(next);
    setSellerOpen(false);
  };

  const selectedLabel = filters.sellerName ?? "Todos os vendedores";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg font-medium transition-all",
              filters.period === opt.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setSellerOpen(!sellerOpen)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-sm font-medium transition-colors",
            filters.sellerName
              ? "border-indigo-300 text-indigo-700 bg-indigo-50/50"
              : "border-gray-200 text-gray-700 hover:border-gray-300"
          )}
        >
          <Users size={14} className={filters.sellerName ? "text-indigo-500" : "text-gray-400"} />
          <span className="max-w-[180px] truncate">{selectedLabel}</span>
          <ChevronDown
            size={14}
            className={cn("text-gray-400 transition-transform shrink-0", sellerOpen && "rotate-180")}
          />
        </button>

        {sellerOpen && (
          <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-52 max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectSeller(null)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                !filters.sellerName ? "text-indigo-600 font-medium" : "text-gray-600"
              )}
            >
              Todos os vendedores
            </button>
            {sellersList.length > 0 && <div className="h-px bg-gray-100 mx-2 my-1" />}
            {sellersList.map((seller) => (
              <button
                key={seller.id}
                type="button"
                onClick={() => selectSeller(seller.name)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                  filters.sellerName === seller.name
                    ? "text-indigo-600 font-medium bg-indigo-50/40"
                    : "text-gray-600"
                )}
              >
                {seller.name}
              </button>
            ))}
            {sellersList.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">Nenhum vendedor nos pedidos</p>
            )}
          </div>
        )}
      </div>

      {sellerOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSellerOpen(false)} />
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
      >
        <RefreshCw size={13} className={cn(isRefreshing && "animate-spin")} />
        <span className="hidden sm:inline">Atualizar</span>
      </button>
    </div>
  );
}
