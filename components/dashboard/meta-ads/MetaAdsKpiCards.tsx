"use client";

import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { MetaAdsData } from "@/lib/api/meta-ads";

interface MetaAdsKpiCardsProps {
  data: MetaAdsData;
}

type ColorKey = "green" | "yellow" | "red" | "blue" | "gray";

function roasColor(v: number): ColorKey {
  if (v >= 3) return "green";
  if (v >= 1) return "yellow";
  return "red";
}

function ctrColor(v: number): ColorKey {
  if (v >= 2) return "green";
  if (v >= 1) return "yellow";
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

export function MetaAdsKpiCards({ data }: MetaAdsKpiCardsProps) {
  const cards = [
    { label: "Gasto Total", value: formatCurrency(data.spend), sub: "com imposto Meta (BRL)", color: "blue" as ColorKey },
    { label: "Impressões", value: formatNumber(data.impressions), sub: `alcance ${formatNumber(data.reach)}`, color: "gray" as ColorKey },
    { label: "Cliques", value: formatNumber(data.clicks), sub: `CPC ${formatCurrency(data.cpc)}`, color: "gray" as ColorKey },
    { label: "CTR", value: `${data.ctr.toFixed(2)}%`, sub: "taxa de clique", color: ctrColor(data.ctr) },
    { label: "Leads", value: formatNumber(data.leads), sub: "via actions Meta", color: "blue" as ColorKey },
    { label: "CPL", value: data.leads > 0 ? formatCurrency(data.cpl) : "—", sub: "custo por lead", color: "gray" as ColorKey },
    { label: "CPA", value: data.purchases > 0 ? formatCurrency(data.cpa) : "—", sub: `${data.purchases} compras`, color: "gray" as ColorKey },
    { label: "ROAS", value: `${data.roas.toFixed(2)}x`, sub: "reportado Meta", color: roasColor(data.roas) },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            "min-w-[150px] shrink-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-950",
            BORDER[c.color]
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{c.label}</p>
          <p className={cn("mt-1 text-xl font-bold tabular-nums", VALUE[c.color])}>{c.value}</p>
          <p className="mt-1 text-xs text-gray-500">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
