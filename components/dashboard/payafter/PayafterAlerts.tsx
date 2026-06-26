"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayafterAlert } from "@/types";

interface PayafterAlertsProps {
  alerts: PayafterAlert[];
  onAlertClick: (alert: PayafterAlert) => void;
}

export function PayafterAlerts({ alerts, onAlertClick }: PayafterAlertsProps) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          onClick={() => onAlertClick(alert)}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:opacity-90",
            alert.severity === "red"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span className="font-medium">{alert.message}</span>
        </button>
      ))}
    </div>
  );
}
