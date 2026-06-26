import { AGENDADO_PAYMENT_TYPES } from "@/lib/five-webhook";
import { pctChange, prevPeriod, round2, safeDivide } from "@/lib/finance";
import type { KanbanColumn, PayafterFunnelStep } from "@/types";

export const PAYAFTER_TYPES = [...AGENDADO_PAYMENT_TYPES] as string[];

export const ENVIADOS_STATUSES: KanbanColumn[] = [
  "em_transito",
  "retirar_correios",
  "requer_atencao",
  "entregue",
  "pagos",
  "devolvidos",
  "inadimplentes",
];

export const ENTREGUES_STATUSES: KanbanColumn[] = [
  "entregue",
  "pagos",
  "inadimplentes",
];

export interface PayafterOrderRow {
  id: string;
  order_number: string | null;
  display_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  value: number;
  kanban_status: string;
  payment_type: string | null;
  seller_name: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

export function isPayafterType(paymentType: string | null): boolean {
  return PAYAFTER_TYPES.includes(paymentType ?? "");
}

export function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86400000);
}

export function sumValue(rows: PayafterOrderRow[], filter: (r: PayafterOrderRow) => boolean): number {
  return round2(rows.filter(filter).reduce((s, r) => s + Number(r.value), 0));
}

export function countRows(rows: PayafterOrderRow[], filter: (r: PayafterOrderRow) => boolean): number {
  return rows.filter(filter).length;
}

export function pct(part: number, total: number): number {
  return round2(safeDivide(part, total) * 100);
}

export function computeKpis(
  periodOrders: PayafterOrderRow[],
  prevAgendamentos: number,
  adSpend: number
) {
  const agendamentos = periodOrders.length;
  const convertidos = countRows(
    periodOrders,
    (o) => o.kanban_status !== "pedidos_criados"
  );
  const enviados = countRows(periodOrders, (o) =>
    ENVIADOS_STATUSES.includes(o.kanban_status as KanbanColumn)
  );
  const entregues = countRows(periodOrders, (o) =>
    ENTREGUES_STATUSES.includes(o.kanban_status as KanbanColumn)
  );
  const pagos = countRows(periodOrders, (o) => o.kanban_status === "pagos");
  const emRiscoRows = periodOrders.filter((o) => o.kanban_status === "entregue");
  const inadimplentesRows = periodOrders.filter((o) => o.kanban_status === "inadimplentes");
  const devolvidos = countRows(periodOrders, (o) => o.kanban_status === "devolvidos");

  const faturamentoPagos = sumValue(periodOrders, (o) => o.kanban_status === "pagos");
  const inadimplentesValor = sumValue(periodOrders, (o) => o.kanban_status === "inadimplentes");
  const devolucaoValor = sumValue(periodOrders, (o) => o.kanban_status === "devolvidos");
  const faturamentoTotal = faturamentoPagos + inadimplentesValor;

  const lucroEstimado = round2(
    faturamentoPagos - adSpend - inadimplentesValor - devolucaoValor
  );

  return {
    agendamentos,
    convertidos,
    taxa_conversao: pct(convertidos, agendamentos),
    enviados,
    entregues,
    taxa_entrega: pct(entregues, enviados),
    pagos,
    taxa_pagamento: pct(pagos, entregues),
    em_risco_count: emRiscoRows.length,
    em_risco_valor: sumValue(periodOrders, (o) => o.kanban_status === "entregue"),
    inadimplentes_count: inadimplentesRows.length,
    inadimplentes_valor: inadimplentesValor,
    devolvidos,
    taxa_devolucao: pct(devolvidos, enviados),
    lucro_estimado: lucroEstimado,
    margem: pct(lucroEstimado, faturamentoPagos),
    variacao_agendamentos: pctChange(agendamentos, prevAgendamentos),
    gasto_anuncio: round2(adSpend),
    faturamento_pagos: faturamentoPagos,
  };
}

export function buildFunnel(periodOrders: PayafterOrderRow[]): PayafterFunnelStep[] {
  const agendamentos = periodOrders.length;
  const pedidosCriados = periodOrders.length;
  const enviados = countRows(periodOrders, (o) =>
    ENVIADOS_STATUSES.includes(o.kanban_status as KanbanColumn)
  );
  const entregues = countRows(periodOrders, (o) =>
    ENTREGUES_STATUSES.includes(o.kanban_status as KanbanColumn)
  );
  const pagos = countRows(periodOrders, (o) => o.kanban_status === "pagos");
  const emRisco = countRows(periodOrders, (o) => o.kanban_status === "entregue");
  const inadimplentes = countRows(periodOrders, (o) => o.kanban_status === "inadimplentes");
  const devolvidos = countRows(periodOrders, (o) => o.kanban_status === "devolvidos");

  const steps = [
    { id: "agendamentos", label: "Agendamentos", count: agendamentos, value: sumValue(periodOrders, () => true) },
    { id: "pedidos_criados", label: "Pedidos Criados", count: pedidosCriados, value: sumValue(periodOrders, () => true) },
    { id: "enviados", label: "Enviados", count: enviados, value: sumValue(periodOrders, (o) => ENVIADOS_STATUSES.includes(o.kanban_status as KanbanColumn)) },
    { id: "entregues", label: "Entregues", count: entregues, value: sumValue(periodOrders, (o) => ENTREGUES_STATUSES.includes(o.kanban_status as KanbanColumn)) },
    { id: "pagos", label: "Pagos", count: pagos, value: sumValue(periodOrders, (o) => o.kanban_status === "pagos") },
  ];

  const mainSteps = steps.map((step, i) => ({
    ...step,
    conversionPct: i === 0 ? 100 : pct(step.count, steps[i - 1].count),
    branch: false,
  }));
  const branchSteps = [
    { id: "em_risco",      label: "Em Risco",      count: emRisco,      value: sumValue(periodOrders, (o) => o.kanban_status === "entregue"),       conversionPct: pct(emRisco, entregues),       branch: true },
    { id: "inadimplentes", label: "Inadimplentes", count: inadimplentes, value: sumValue(periodOrders, (o) => o.kanban_status === "inadimplentes"), conversionPct: pct(inadimplentes, entregues), branch: true },
    { id: "devolvidos",    label: "Devolvidos",    count: devolvidos,    value: sumValue(periodOrders, (o) => o.kanban_status === "devolvidos"),     conversionPct: pct(devolvidos, enviados),      branch: true },
  ];
  return [...mainSteps, ...branchSteps];
}

export function buildSellersExpanded(periodOrders: PayafterOrderRow[]) {
  const map = new Map<string, {
    agendamentos: number;
    convertidos: number;
    inadimplentes: number;
  }>();

  for (const o of periodOrders) {
    const key = o.seller_name?.trim() || "Sem vendedor";
    const cur = map.get(key) ?? { agendamentos: 0, convertidos: 0, inadimplentes: 0 };
    cur.agendamentos += 1;
    if (o.kanban_status !== "pedidos_criados") cur.convertidos += 1;
    if (o.kanban_status === "inadimplentes") cur.inadimplentes += 1;
    map.set(key, cur);
  }

  return Array.from(map.entries())
    .map(([sellerName, stats]) => ({
      sellerId: sellerName,
      sellerName,
      agendamentos: stats.agendamentos,
      convertidos: stats.convertidos,
      taxaConversao: pct(stats.convertidos, stats.agendamentos),
      taxaInadimplencia: pct(stats.inadimplentes, stats.convertidos),
    }))
    .sort((a, b) => b.convertidos - a.convertidos);
}

export function buildWeeklyPaymentRate(periodOrders: PayafterOrderRow[]) {
  const weeks = new Map<string, { entregues: number; pagos: number }>();

  for (const o of periodOrders) {
    if (!ENTREGUES_STATUSES.includes(o.kanban_status as KanbanColumn)) continue;
    const d = new Date(o.updated_at);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const key = start.toISOString().slice(0, 10);
    const cur = weeks.get(key) ?? { entregues: 0, pagos: 0 };
    cur.entregues += 1;
    if (o.kanban_status === "pagos") cur.pagos += 1;
    weeks.set(key, cur);
  }

  return Array.from(weeks.entries())
    .map(([weekStart, v]) => ({
      week: weekStart,
      label: weekStart.slice(8, 10) + "/" + weekStart.slice(5, 7),
      taxa: pct(v.pagos, v.entregues),
      entregues: v.entregues,
      pagos: v.pagos,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export { prevPeriod, pctChange };
