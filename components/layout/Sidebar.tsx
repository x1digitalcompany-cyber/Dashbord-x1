"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Columns3,
  CalendarDays,
  CreditCard,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LS_KEY = "dashboard-x1-sidebar-collapsed";
const WIDTH_OPEN = 240;
const WIDTH_COLLAPSED = 60;

export const SIDEBAR_WIDTH_OPEN = WIDTH_OPEN;
export const SIDEBAR_WIDTH_COLLAPSED = WIDTH_COLLAPSED;

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/kanban", label: "Kanban Five", icon: Columns3 },
  { href: "/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LS_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(LS_KEY, String(collapsed));
  } catch {
    /* ignore */
  }
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-[width] duration-300 ease-in-out",
        "bg-white border-gray-200 text-gray-900",
        "dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100"
      )}
      style={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_OPEN }}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-gray-100 dark:border-gray-800",
          collapsed ? "justify-center px-2" : "justify-between px-3"
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              <LayoutDashboard size={15} className="text-white" />
            </div>
            <span className="truncate text-sm font-bold tracking-tight">
              Dashboard X1
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors",
            "hover:bg-gray-100 hover:text-gray-900",
            "dark:hover:bg-gray-800 dark:hover:text-gray-100"
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center rounded-xl text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-gray-100 p-2 dark:border-gray-800",
          collapsed && "flex flex-col items-center"
        )}
      >
        {!collapsed && session?.user?.email && (
          <p
            className="mb-2 truncate px-2 text-xs text-gray-400 dark:text-gray-500"
            title={session.user.email}
          >
            {session.user.email}
          </p>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sair"
          className={cn(
            "flex items-center rounded-xl text-sm text-gray-500 transition-colors",
            "hover:bg-red-50 hover:text-red-600",
            "dark:hover:bg-red-950/40 dark:hover:text-red-400",
            collapsed ? "h-9 w-9 justify-center" : "w-full gap-3 px-3 py-2.5"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(loadCollapsed());
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  };

  return { collapsed, toggle, hydrated };
}
