"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  LucideIcon,
} from "lucide-react";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  value: string;
  subLabel: string;
  subValue: string;
  variationPct?: number;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
}

export function KpiCard({
  title,
  icon: Icon,
  iconColor,
  value,
  subLabel,
  subValue,
  variationPct,
  loading,
  error,
  onClick,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 flex-1 min-w-0">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {title}
        </p>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const isPositive = variationPct !== undefined && variationPct > 0;
  const isNegative = variationPct !== undefined && variationPct < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-w-0 text-left transition-all duration-150",
        onClick && "hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <span className={cn("p-1.5 rounded-lg", iconColor)}>
          <Icon size={14} />
        </span>
      </div>

      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {subLabel}: <span className="font-medium text-gray-700">{subValue}</span>
        </span>

        {variationPct !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isPositive && "text-emerald-600",
              isNegative && "text-red-500",
              !isPositive && !isNegative && "text-gray-400"
            )}
          >
            <TrendIcon size={12} />
            {formatPercent(variationPct)}
          </span>
        )}
      </div>
    </button>
  );
}
