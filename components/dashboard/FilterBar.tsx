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
    localStorage.setItem(LS_KEY, JSON.stringify({ period: f.period, sellerIds: f.sellerIds }));
  } catch (_) {}
}

export function loadSavedFilters(): Partial<Pick<GlobalFilters, "period" | "sellerIds">> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

export function FilterBar({ filters, onChange, onRefresh, isRefreshing }: FilterBarProps) {
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellersList, setSellersList] = useState<SellerItem[]>([]);

  // Busca lista de sellers uma vez
  useEffect(() => {
    fetch("/api/dashboard/sellers-list")
      .then((r) => r.ok ? r.json() : [])
      .then((data: SellerItem[]) => setSellersList(data))
      .catch(() => {});
  }, []);

  const setPeriod = (period: PeriodOption) => {
    if (period === "custom") return;
    const next = { ...filters, period, dateRange: getDateRange(period) };
    saveFilters(next);
    onChange(next);
  };

  const toggleSeller = (id: string) => {
    const already = filters.sellerIds.includes(id);
    const next = {
      ...filters,
      sellerIds: already
        ? filters.sellerIds.filter((s) => s !== id)
        : [...filters.sellerIds, id],
    };
    saveFilters(next);
    onChange(next);
  };

  const clearSellers = () => {
    const next = { ...filters, sellerIds: [] };
    saveFilters(next);
    onChange(next);
  };

  const selectedLabels =
    filters.sellerIds.length === 0
      ? "Todos os vendedores"
      : filters.sellerIds.length === 1
      ? sellersList.find((s) => s.id === filters.sellerIds[0])?.name ?? "1 vendedor"
      : `${filters.sellerIds.length} vendedores`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Period selector */}
      <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
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

      {/* Seller selector */}
      <div className="relative">
        <button
          onClick={() => setSellerOpen(!sellerOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors"
        >
          <Users size={14} className="text-gray-400" />
          <span>{selectedLabels}</span>
          <ChevronDown
            size={14}
            className={cn("text-gray-400 transition-transform", sellerOpen && "rotate-180")}
          />
        </button>

        {sellerOpen && (
          <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-48">
            <button
              onClick={clearSellers}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                filters.sellerIds.length === 0 ? "text-indigo-600 font-medium" : "text-gray-600"
              )}
            >
              Todos os vendedores
            </button>
            {sellersList.length > 0 && <div className="h-px bg-gray-100 mx-2 my-1" />}
            {sellersList.map((seller) => (
              <button
                key={seller.id}
                onClick={() => toggleSeller(seller.id)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-50 transition-colors",
                  filters.sellerIds.includes(seller.id) ? "text-indigo-600 font-medium" : "text-gray-600"
                )}
              >
                <span
                  className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                    filters.sellerIds.includes(seller.id)
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-gray-300"
                  )}
                >
                  {filters.sellerIds.includes(seller.id) && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                      <path d="M8.5 2.5L4 7.5L1.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </span>
                {seller.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {sellerOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSellerOpen(false)} />
      )}

      {/* Refresh */}
      <button
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
