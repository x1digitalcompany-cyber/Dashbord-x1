"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { MetaCampaignRow } from "@/lib/api/meta-ads";

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return { label: "Ativa", variant: "green" as const };
  if (s === "PAUSED") return { label: "Pausada", variant: "yellow" as const };
  if (s === "ARCHIVED" || s === "DELETED") return { label: "Encerrada", variant: "red" as const };
  return { label: status, variant: "blue" as const };
}

export function MetaAdsCampaignsTable({ campaigns }: { campaigns: MetaCampaignRow[] }) {
  if (!campaigns.length) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-950">
        Nenhuma campanha com gasto no período.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold dark:border-gray-800">
        Campanhas
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-left text-xs text-gray-400">
              <th className="px-5 py-3">Campanha</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Gasto R$</th>
              <th className="px-5 py-3 text-right">% gasto</th>
              <th className="px-5 py-3 text-right">Impressões</th>
              <th className="px-5 py-3 text-right">Cliques</th>
              <th className="px-5 py-3 text-right">Leads</th>
              <th className="px-5 py-3 text-right">CPL R$</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const st = statusBadge(c.status);
              return (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="max-w-[200px] truncate px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{formatCurrency(c.spend)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {(c.percentual_gasto ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right">{formatNumber(c.impressions)}</td>
                  <td className="px-5 py-3 text-right">{formatNumber(c.clicks)}</td>
                  <td className="px-5 py-3 text-right">{formatNumber(c.leads)}</td>
                  <td className="px-5 py-3 text-right">
                    {c.leads > 0 ? formatCurrency(c.cpl) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
