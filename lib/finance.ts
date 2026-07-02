import type { KanbanColumn } from "@/types";

export const REVENUE_STATUSES: KanbanColumn[] = ["pagos", "inadimplentes"];
export const SALE_STATUS: KanbanColumn = "pagos";
export const DEFAULT_STATUS: KanbanColumn = "inadimplentes";

// Antecipado orders reach "entregue" as their final paid state (migration 006).
// Agendado/payafter orders reach "pagos"/"inadimplentes".
export function isRevenue(o: { kanban_status: string; payment_type?: string | null }): boolean {
  if (o.payment_type === "antecipado") return o.kanban_status === "entregue";
  return REVENUE_STATUSES.includes(o.kanban_status as KanbanColumn);
}

export function isSale(o: { kanban_status: string; payment_type?: string | null }): boolean {
  if (o.payment_type === "antecipado") return o.kanban_status === "entregue";
  return o.kanban_status === SALE_STATUS;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function safeDivide(a: number, b: number): number {
  if (!b) return 0;
  return a / b;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function prevPeriod(from: Date, to: Date) {
  const len = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - len),
    to: new Date(from.getTime()),
  };
}

export function normalizeUf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s.length === 2) return s;
  const names: Record<string, string> = {
    ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA",
    CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPÍRITO SANTO": "ES",
    GOIAS: "GO", GOIÁS: "GO", MARANHAO: "MA", MARANHÃO: "MA",
    "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG",
    PARA: "PA", PARÁ: "PA", PARAIBA: "PB", PARAÍBA: "PB", PARANA: "PR",
    PARANÁ: "PR", PERNAMBUCO: "PE", PIAUI: "PI", PIAUÍ: "PI",
    "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS",
    RONDONIA: "RO", RONDÔNIA: "RO", RORAIMA: "RR", "SANTA CATARINA": "SC",
    "SAO PAULO": "SP", "SÃO PAULO": "SP", SERGIPE: "SE", TOCANTINS: "TO",
  };
  return names[s] ?? null;
}
