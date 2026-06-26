"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  DollarSign,
  Megaphone,
  PiggyBank,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
  Percent,
  Pencil,
} from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetchOnFilters } from "@/contexts/DashboardFiltersContext";
import type { KpiData } from "@/types";

const META_IMPOSTO_KEY = "meta_imposto_ativo";
const META_TAX_RATE = 0.125;

interface FinanceCardProps {
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
  headerExtra?: React.ReactNode;
}

function FinanceCard({
  label,
  icon: Icon,
  iconBg,
  iconColor,
  value,
  subtext,
  highlight,
  headerExtra,
}: FinanceCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        highlight
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
          : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {headerExtra ?? (
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {label}
            </span>
          )}
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon size={16} className={iconColor} />
        </div>
      </div>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums tracking-tight",
          highlight ? "text-emerald-800 dark:text-emerald-200" : "text-gray-900 dark:text-gray-100"
        )}
      >
        {value}
      </p>
      {subtext && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{subtext}</p>
      )}
    </div>
  );
}

function ImpostoToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
        active ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform",
          active ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function DashboardFinanceGrid() {
  const [impostoAtivo, setImpostoAtivo] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(META_IMPOSTO_KEY);
      if (saved !== null) setImpostoAtivo(saved === "true");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleImposto(next: boolean) {
    setImpostoAtivo(next);
    try {
      localStorage.setItem(META_IMPOSTO_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  const kpi = useFetchOnFilters<KpiData>(async (params, signal) => {
    const res = await fetch(`/api/dashboard/kpi?${params}`, { signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Falha ao carregar KPIs");
    }
    return res.json();
  });

  if (kpi.loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (kpi.error || !kpi.data?.finance) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        {kpi.error ?? "Falha ao carregar métricas financeiras"}
      </div>
    );
  }

  const f = kpi.data.finance;
  const gasto = f.gastoAnuncios;
  const imposto = impostoAtivo ? gasto * META_TAX_RATE : 0;
  const investimentoTotal = gasto + imposto;
  const custoAds = impostoAtivo ? investimentoTotal : gasto;

  const lucroLiquido = f.faturamentoTotal - custoAds;
  const roas = custoAds > 0 ? f.faturamentoTotal / custoAds : 0;
  const ticketMedio = f.totalVendas > 0 ? f.faturamentoTotal / f.totalVendas : 0;
  const leadsPorVenda = f.totalVendas > 0 ? f.agendamentosCriados / f.totalVendas : 0;
  const taxaConversao =
    f.agendamentosCriados > 0 ? (f.totalVendas / f.agendamentosCriados) * 100 : 0;
  const cpaMedio = f.totalVendas > 0 ? gasto / f.totalVendas : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <FinanceCard
        label="Faturamento Total"
        icon={DollarSign}
        iconBg="bg-violet-100"
        iconColor="text-violet-600"
        value={formatCurrency(f.faturamentoTotal)}
      />
      <FinanceCard
        label="Gasto com Anúncios"
        icon={Megaphone}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        value={formatCurrency(gasto)}
      />
      <FinanceCard
        label="Lucro Líquido"
        icon={PiggyBank}
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        value={formatCurrency(lucroLiquido)}
        subtext="Lucro real"
        highlight
      />

      <FinanceCard
        label="Total de Vendas"
        icon={ShoppingBag}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        value={formatNumber(f.totalVendas)}
      />
      <FinanceCard
        label="Ticket Médio"
        icon={Target}
        iconBg="bg-rose-100"
        iconColor="text-rose-600"
        value={formatCurrency(ticketMedio)}
      />
      <FinanceCard
        label="ROAS"
        icon={TrendingUp}
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        value={`${roas.toFixed(2)}x`}
        subtext="Return on Ad Spend"
        highlight
      />

      <FinanceCard
        label="Total Agendamentos"
        icon={Users}
        iconBg="bg-sky-100"
        iconColor="text-sky-600"
        value={formatNumber(f.agendamentosCriados)}
        subtext="Pedidos agendados criados"
      />
      <FinanceCard
        label="Leads por Venda"
        icon={Users}
        iconBg="bg-indigo-100"
        iconColor="text-indigo-600"
        value={leadsPorVenda.toFixed(1)}
        subtext="Quantos leads p/ 1 venda"
      />
      <FinanceCard
        label="Taxa de Conversão"
        icon={Percent}
        iconBg="bg-orange-100"
        iconColor="text-orange-600"
        value={`${taxaConversao.toFixed(1)}%`}
        subtext="Vendas / Leads"
      />

      <FinanceCard
        label="CPA Médio"
        icon={DollarSign}
        iconBg="bg-teal-100"
        iconColor="text-teal-600"
        value={formatCurrency(cpaMedio)}
        subtext="Custo por aquisição"
      />
      <FinanceCard
        label="Imposto Meta Ads"
        icon={Megaphone}
        iconBg="bg-gray-100"
        iconColor="text-gray-600"
        value={formatCurrency(imposto)}
        subtext={impostoAtivo ? "Ativado" : "Desativado"}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Imposto Meta Ads
            </span>
            <Pencil size={12} className="text-gray-400" />
            <ImpostoToggle active={impostoAtivo} onChange={toggleImposto} />
            <span className="text-[10px] font-semibold uppercase text-gray-400">
              {impostoAtivo ? "ON" : "OFF"}
            </span>
          </div>
        }
      />
      <FinanceCard
        label="Investimento Total"
        icon={Megaphone}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        value={formatCurrency(investimentoTotal)}
        subtext="Anúncios + Imposto"
      />
    </div>
  );
}
