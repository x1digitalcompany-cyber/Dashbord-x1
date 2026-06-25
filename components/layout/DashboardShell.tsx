"use client";

import { SessionProvider } from "next-auth/react";
import {
  Sidebar,
  useSidebarCollapsed,
  SIDEBAR_WIDTH_OPEN,
  SIDEBAR_WIDTH_COLLAPSED,
} from "@/components/layout/Sidebar";
import { DashboardFiltersProvider } from "@/contexts/DashboardFiltersContext";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import { cn } from "@/lib/utils";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle, hydrated } = useSidebarCollapsed();
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out",
          !hydrated && "ml-[240px]"
        )}
        style={hydrated ? { marginLeft: sidebarWidth } : undefined}
      >
        <DashboardTopbar />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardFiltersProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </DashboardFiltersProvider>
    </SessionProvider>
  );
}
