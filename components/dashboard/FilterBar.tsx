"use client";

import { useState, useEffect, useRef } from "react";
import { Users, ChevronDown, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCustomPeriodLabel,
  getDateRangeForPeriod,
  saveFiltersToStorage,
} from "@/lib/period";
import type { GlobalFilters, PeriodOption } from "@/types";

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

interface SellerItem {
  id: string;
  name: string;
}

interface FilterBarProps {
  filters: GlobalFilters;
  onChange: (filters: GlobalFilters) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function FilterBar({ filters, onChange, onRefresh, isRefreshing }: FilterBarProps) {
  const [sellerOpen, setSellerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [sellersList, setSellersList] = useState<SellerItem[]>([]);
  const [customFrom, setCustomFrom] = useState(filters.customFrom ?? daysAgoIso(30));
  const [customTo, setCustomTo] = useState(filters.customTo ?? todayIso());
  const customRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/sellers-list")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SellerItem[]) => setSellersList(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (filters.customFrom) setCustomFrom(filters.customFrom);
    if (filters.customTo) setCustomTo(filters.customTo);
  }, [filters.customFrom, filters.customTo]);

  const applyPeriod = (period: PeriodOption, custom?: { from: string; to: string }) => {
    const dateRange = getDateRangeForPeriod(period, custom);
    const next: GlobalFilters = {
      ...filters,
      period,
      dateRange,
      customFrom: period === "custom" ? custom?.from : undefined,
      customTo: period === "custom" ? custom?.to : undefined,
    };
    saveFiltersToStorage(next);
    onChange(next);
  };

  const handlePeriodClick = (period: PeriodOption) => {
    if (period === "custom") {
      setCustomOpen((o) => !o);
      return;
    }
    setCustomOpen(false);
    applyPeriod(period);
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    applyPeriod("custom", { from: customFrom, to: customTo });
    setCustomOpen(false);
  };

  const selectSeller = (name: string | null) => {
    const next = { ...filters, sellerName: name };
    saveFiltersToStorage(next);
    onChange(next);
    setSellerOpen(false);
  };

  const selectedLabel = filters.sellerName ?? "Todos os vendedores";

  const customLabel =
    filters.period === "custom" && filters.customFrom && filters.customTo
      ? formatCustomPeriodLabel(filters.customFrom, filters.customTo)
      : "Personalizado";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handlePeriodClick(opt.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg font-medium transition-all whitespace-nowrap",
              filters.period === opt.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            {opt.value === "custom" ? customLabel : opt.label}
          </button>
        ))}

        {customOpen && (
          <div
            ref={customRef}
            className="absolute top-full left-0 z-30 mt-2 w-72 rounded-xl border border-gray-100 bg-white p-4 shadow-lg"
          >
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Calendar size={12} />
              Período personalizado
            </p>
            <div className="space-y-3">
              <label className="block text-xs text-gray-500">
                De
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
                />
              </label>
              <label className="block text-xs text-gray-500">
                Até
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
                />
              </label>
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={!customFrom || !customTo || customFrom > customTo}
                className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      {customOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setCustomOpen(false)} />
      )}

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
