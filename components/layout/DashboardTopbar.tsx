"use client";

import { FilterBar } from "@/components/dashboard/FilterBar";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";

export function DashboardTopbar() {
  const { filters, setFilters, refresh, isRefreshing } = useDashboardFilters();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="flex h-14 items-center px-6">
        <div className="min-w-0 flex-1">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onRefresh={refresh}
            isRefreshing={isRefreshing}
          />
        </div>
      </div>
    </header>
  );
}
