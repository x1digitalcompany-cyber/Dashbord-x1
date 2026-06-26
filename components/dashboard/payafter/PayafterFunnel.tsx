"use client";

import {
  CalendarCheck,
  Package,
  Truck,
  PackageCheck,
  CircleDollarSign,
  AlertTriangle,
  Ban,
  RotateCcw,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PayafterFunnelStep } from "@/types";

const ICONS: Record<string, typeof CalendarCheck> = {
  agendamentos: CalendarCheck,
  pedidos_criados: Package,
  enviados: Truck,
  entregues: PackageCheck,
  pagos: CircleDollarSign,
  em_risco: AlertTriangle,
  inadimplentes: Ban,
  devolvidos: RotateCcw,
};

interface PayafterFunnelProps {
  steps: PayafterFunnelStep[];
  onStepClick?: (step: PayafterFunnelStep) => void;
}

export function PayafterFunnel({ steps, onStepClick }: PayafterFunnelProps) {
  const mainSteps = steps.filter((s) => !s.branch);
  const branchSteps = steps.filter((s) => s.branch);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Funil PayAfter
      </h3>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
        {mainSteps.map((step, i) => {
          const Icon = ICONS[step.id] ?? Package;
          const widthPct = Math.max(
            20,
            mainSteps[0].count > 0 ? (step.count / mainSteps[0].count) * 100 : 20
          );
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-2 lg:flex-row">
              {i > 0 && (
                <span className="hidden text-xs text-gray-400 lg:block">
                  {step.conversionPct.toFixed(0)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => onStepClick?.(step)}
                className="flex w-full flex-col items-center rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 transition-colors hover:bg-indigo-50"
                style={{ flex: widthPct }}
              >
                <Icon size={20} className="text-indigo-600" />
                <span className="mt-1 text-xs font-medium text-gray-500">{step.label}</span>
                <span className="text-lg font-bold text-gray-900">{formatNumber(step.count)}</span>
                <span className="text-xs text-indigo-600">{formatCurrency(step.value)}</span>
                {i > 0 && (
                  <span className="mt-1 text-[10px] text-gray-400 lg:hidden">
                    {step.conversionPct.toFixed(0)}% da etapa anterior
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {branchSteps.map((step) => {
          const Icon = ICONS[step.id] ?? AlertTriangle;
          const colors =
            step.id === "em_risco"
              ? "border-amber-200 bg-amber-50"
              : step.id === "inadimplentes"
                ? "border-red-200 bg-red-50"
                : "border-orange-200 bg-orange-50";
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:opacity-90 ${colors}`}
            >
              <Icon size={18} className="shrink-0 text-gray-600" />
              <div>
                <p className="text-xs font-medium text-gray-600">{step.label}</p>
                <p className="font-bold text-gray-900">{formatNumber(step.count)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(step.value)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
