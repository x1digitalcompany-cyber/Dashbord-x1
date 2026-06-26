"use client";

import { useEffect, useRef, useState } from "react";
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
const META_IMPOSTO_PERCENTUAL_KEY = "meta_imposto_percentual";
const DEFAULT_IMPOSTO_PERCENTUAL = 12.5;

function clampPercentual(value: number): number {
  return Math.min(50, Math.max(0, Math.round(value * 10) / 10));
}

function formatPercentualLabel(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}% sobre o gasto`;
}

function readPercentualFromStorage(): number {
  try {
    const saved = localStorage.getItem(META_IMPOSTO_PERCENTUAL_KEY);
    if (saved === null) return DEFAULT_IMPOSTO_PERCENTUAL;
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? clampPercentual(parsed) : DEFAULT_IMPOSTO_PERCENTUAL;
  } catch {
    return DEFAULT_IMPOSTO_PERCENTUAL;
  }
}

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
      onClick={(e) => {
        e.stopPropagation();
        onChange(!active);
      }}
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

function ImpostoMetaAdsCard({
  imposto,
  impostoAtivo,
  percentual,
  onToggle,
  onPercentualChange,
}: {
  imposto: number;
  impostoAtivo: boolean;
  percentual: number;
  onToggle: (v: boolean) => void;
  onPercentualChange: (v: number) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draftPercentual, setDraftPercentual] = useState(String(percentual));
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [popoverOpen]);

  function openPopover() {
    setDraftPercentual(String(percentual));
    setPopoverOpen(true);
  }

  function handleCancel() {
    setPopoverOpen(false);
  }

  function handleSave() {
    const parsed = Number(draftPercentual.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    const next = clampPercentual(parsed);
    onPercentualChange(next);
    setPopoverOpen(false);
  }

  const subtext = impostoAtivo ? formatPercentualLabel(percentual) : "Desativado";

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Imposto Meta Ads
            </span>
            <button
              type="button"
              onClick={openPopover}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              aria-label="Editar alíquota do imposto"
            >
              <Pencil size={12} />
            </button>
            <ImpostoToggle active={impostoAtivo} onChange={onToggle} />
            <span className="text-[10px] font-semibold uppercase text-gray-400">
              {impostoAtivo ? "ON" : "OFF"}
            </span>
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <Megaphone size={16} className="text-gray-600" />
        </div>
      </div>

      <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
        {formatCurrency(imposto)}
      </p>
      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{subtext}</p>

      {popoverOpen && (
        <div className="absolute right-4 top-12 z-50 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            Alíquota do imposto
          </p>
          <div className="mb-3 flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={draftPercentual}
              placeholder="12.5"
              onChange={(e) => setDraftPercentual(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-800"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardFinanceGrid() {
  const [impostoAtivo, setImpostoAtivo] = useState(false);
  const [impostoPercentual, setImpostoPercentual] = useState(DEFAULT_IMPOSTO_PERCENTUAL);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(META_IMPOSTO_KEY);
      if (saved !== null) setImpostoAtivo(saved === "true");
      setImpostoPercentual(readPercentualFromStorage());
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

  function saveImpostoPercentual(next: number) {
    const value = clampPercentual(next);
    setImpostoPercentual(value);
    try {
      localStorage.setItem(META_IMPOSTO_PERCENTUAL_KEY, String(value));
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
  const taxRate = impostoPercentual / 100;
  const imposto = impostoAtivo ? gasto * taxRate : 0;
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
      <ImpostoMetaAdsCard
        imposto={imposto}
        impostoAtivo={impostoAtivo}
        percentual={impostoPercentual}
        onToggle={toggleImposto}
        onPercentualChange={saveImpostoPercentual}
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
