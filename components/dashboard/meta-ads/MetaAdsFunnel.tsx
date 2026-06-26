"use client";

import { Megaphone, Users, Package, Truck, PackageCheck, CircleDollarSign } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface FunnelStep {
  id: string;
  label: string;
  count: number;
  conversionPct: number;
}

const ICONS: Record<string, typeof Megaphone> = {
  leads: Megaphone,
  agendamentos: Users,
  pedidos: Package,
  enviados: Truck,
  entregues: PackageCheck,
  pagos: CircleDollarSign,
};

export function MetaAdsFunnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-sm font-semibold">Funil de conversão (Meta + Operação)</h3>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {steps.map((step, i) => {
          const Icon = ICONS[step.id] ?? Megaphone;
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-1">
              {i > 0 && (
                <span className="text-[10px] text-gray-400 lg:hidden">
                  {step.conversionPct.toFixed(0)}% da etapa anterior
                </span>
              )}
              <div className="flex w-full flex-col items-center rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <Icon size={18} className="text-indigo-600" />
                <span className="mt-1 text-center text-xs text-gray-500">{step.label}</span>
                <span className="text-lg font-bold text-gray-900">{formatNumber(step.count)}</span>
                {i > 0 && (
                  <span className="hidden text-[10px] text-gray-400 lg:inline">
                    {step.conversionPct.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
