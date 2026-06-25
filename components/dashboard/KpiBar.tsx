"use client";

import {
  Megaphone,
  Users,
  CalendarCheck,
  CreditCard,
  Landmark,
} from "lucide-react";
import { KpiCard } from "./KpiCard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { KpiData } from "@/types";

interface KpiBarProps {
  data: KpiData | null;
  loading?: boolean;
  error?: string;
}

export function KpiBar({ data, loading, error }: KpiBarProps) {
  const cardError = error ? "Falha ao carregar" : undefined;

  return (
    <div className="flex gap-4 w-full">
      <KpiCard
        title="Gasto com Anúncio"
        icon={Megaphone}
        iconColor="bg-violet-100 text-violet-600"
        value={data ? formatCurrency(data.ads.totalSpend) : "—"}
        subLabel="vs. período ant."
        subValue={data ? formatPercent(data.ads.variationPct) : "—"}
        variationPct={data?.ads.variationPct}
        loading={loading}
        error={cardError}
      />

      <KpiCard
        title="Quantidade de Leads"
        icon={Users}
        iconColor="bg-blue-100 text-blue-600"
        value={data ? formatNumber(data.leads.total) : "—"}
        subLabel="CPL médio"
        subValue={data ? formatCurrency(data.leads.cpl) : "—"}
        variationPct={data?.leads.variationPct}
        loading={loading}
        error={cardError}
      />

      <KpiCard
        title="Agendamentos"
        icon={CalendarCheck}
        iconColor="bg-amber-100 text-amber-600"
        value={data ? formatNumber(data.agendamentos.total) : "—"}
        subLabel="Conversão lead"
        subValue={data ? `${data.agendamentos.conversionRate.toFixed(1)}%` : "—"}
        variationPct={data?.agendamentos.variationPct}
        loading={loading}
        error={cardError}
      />

      <KpiCard
        title="Pagamentos Payt"
        icon={CreditCard}
        iconColor="bg-sky-100 text-sky-600"
        value={data ? formatCurrency(data.payt.volume) : "—"}
        subLabel="Transações"
        subValue={data ? formatNumber(data.payt.transactions) : "—"}
        variationPct={data?.payt.variationPct}
        loading={loading}
        error={cardError}
      />

      <KpiCard
        title="Pagamentos Pagar.me"
        icon={Landmark}
        iconColor="bg-emerald-100 text-emerald-600"
        value={data ? formatCurrency(data.pagarme.volume) : "—"}
        subLabel="Transações"
        subValue={data ? formatNumber(data.pagarme.transactions) : "—"}
        variationPct={data?.pagarme.variationPct}
        loading={loading}
        error={cardError}
      />
    </div>
  );
}
