"use client";

import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { PayafterKpis } from "@/types";

interface PayafterKpiCardsProps {
  kpis: PayafterKpis;
}

type ColorKey = "blue" | "green" | "yellow" | "red" | "gray";

function thresholdColor(
  value: number,
  green: number,
  yellow: number,
  higherIsBetter = true
): ColorKey {
  if (higherIsBetter) {
    if (value >= green) return "green";
    if (value >= yellow) return "yellow";
    return "red";
  }
  if (value <= green) return "green";
  if (value <= yellow) return "yellow";
  return "red";
}

const BORDER: Record<ColorKey, string> = {
  blue: "border-blue-200",
  green: "border-emerald-200",
  yellow: "border-amber-200",
  red: "border-red-200",
  gray: "border-gray-200",
};

const VALUE: Record<ColorKey, string> = {
  blue: "text-blue-700",
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-red-700",
  gray: "text-gray-700",
};

function Card({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: ColorKey;
}) {
  return (
    <div
      className={cn(
        "min-w-[160px] shrink-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-950",
        BORDER[color]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", VALUE[color])}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

export function PayafterKpiCards({ kpis }: PayafterKpiCardsProps) {
  const cards = [
    {
      label: "Agendamentos",
      value: String(kpis.agendamentos),
      sub: `${formatPercent(kpis.variacao_agendamentos)} vs período ant.`,
      color: "blue" as ColorKey,
    },
    {
      label: "Convertidos em Pedido",
      value: `${kpis.taxa_conversao.toFixed(1)}%`,
      sub: `${kpis.convertidos} de ${kpis.agendamentos} agendamentos`,
      color: thresholdColor(kpis.taxa_conversao, 60, 40),
    },
    {
      label: "Taxa de Entrega",
      value: `${kpis.taxa_entrega.toFixed(1)}%`,
      sub: `${kpis.entregues} entregues de ${kpis.enviados} enviados`,
      color: thresholdColor(kpis.taxa_entrega, 85, 70),
    },
    {
      label: "Taxa de Pagamento",
      value: `${kpis.taxa_pagamento.toFixed(1)}%`,
      sub: `${kpis.pagos} pagos de ${kpis.entregues} entregues`,
      color: thresholdColor(kpis.taxa_pagamento, 80, 60),
    },
    {
      label: "Em Risco Agora",
      value: formatCurrency(kpis.em_risco_valor),
      sub: `${kpis.em_risco_count} pedidos aguardando`,
      color: kpis.em_risco_count > 0 ? ("red" as ColorKey) : ("gray" as ColorKey),
    },
    {
      label: "Inadimplência",
      value: formatCurrency(kpis.inadimplentes_valor),
      sub: `${kpis.faturamento_pagos > 0 ? ((kpis.inadimplentes_valor / (kpis.faturamento_pagos + kpis.inadimplentes_valor)) * 100).toFixed(1) : "0"}% do faturamento`,
      color: thresholdColor(
        kpis.faturamento_pagos > 0
          ? (kpis.inadimplentes_valor / (kpis.faturamento_pagos + kpis.inadimplentes_valor)) * 100
          : 0,
        10,
        20,
        false
      ),
    },
    {
      label: "Devolução",
      value: `${kpis.taxa_devolucao.toFixed(1)}%`,
      sub: `${kpis.devolvidos} devolvidos de ${kpis.enviados} enviados`,
      color: thresholdColor(kpis.taxa_devolucao, 8, 15, false),
    },
    {
      label: "Lucro Estimado PayAfter",
      value: formatCurrency(kpis.lucro_estimado),
      sub: `margem ${kpis.margem.toFixed(1)}%`,
      color: kpis.lucro_estimado >= 0 ? ("green" as ColorKey) : ("red" as ColorKey),
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {cards.map((c) => (
        <Card key={c.label} {...c} />
      ))}
    </div>
  );
}
