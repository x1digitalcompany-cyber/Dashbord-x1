import type { GlobalFilters, PeriodOption } from "@/types";

const LS_KEY = "dashboard-x1-filters";

/** Calcula intervalo de datas para o período selecionado. */
export function getDateRangeForPeriod(
  period: PeriodOption,
  custom?: { from: string; to: string }
): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  if (period === "today") {
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (period === "7d") {
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (period === "30d") {
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (period === "custom" && custom?.from && custom?.to) {
    return {
      from: parseDateInput(custom.from, "start"),
      to: parseDateInput(custom.to, "end"),
    };
  }

  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/** Parse de input HTML date (YYYY-MM-DD). */
export function parseDateInput(raw: string, bound: "start" | "end"): Date {
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (bound === "start") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/** Lê from/to dos query params das APIs com suporte a YYYY-MM-DD e ISO. */
export function parseFromToParams(searchParams: {
  get: (name: string) => string | null;
}): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86400000);

  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  return {
    from: parseApiDate(fromRaw ?? defaultFrom.toISOString(), "start"),
    to: parseApiDate(toRaw ?? now.toISOString(), "end"),
  };
}

function parseApiDate(raw: string, bound: "start" | "end"): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return parseDateInput(raw, bound);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return bound === "start" ? new Date(Date.now() - 30 * 86400000) : new Date();
  }
  return date;
}

export function buildApiParams(filters: GlobalFilters): URLSearchParams {
  const params = new URLSearchParams({
    from: filters.dateRange.from.toISOString(),
    to: filters.dateRange.to.toISOString(),
  });
  if (filters.sellerName) {
    params.set("seller", filters.sellerName);
  }
  return params;
}

/** Chave estável para dependências de useEffect. */
export function filtersDependencyKey(filters: GlobalFilters): string {
  return [
    filters.period,
    filters.dateRange.from.getTime(),
    filters.dateRange.to.getTime(),
    filters.sellerName ?? "",
  ].join("|");
}

export interface SavedFilters {
  period?: PeriodOption;
  sellerName?: string | null;
  customFrom?: string;
  customTo?: string;
}

export function loadSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      return JSON.parse(raw) as SavedFilters;
    }
  } catch (_) {}
  return {};
}

export function saveFiltersToStorage(f: GlobalFilters) {
  try {
    const payload: SavedFilters = {
      period: f.period,
      sellerName: f.sellerName,
    };
    if (f.period === "custom" && f.customFrom && f.customTo) {
      payload.customFrom = f.customFrom;
      payload.customTo = f.customTo;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (_) {}
}

export function buildInitialFilters(): GlobalFilters {
  const saved = loadSavedFilters();
  const period = saved.period ?? "30d";
  const custom =
    period === "custom" && saved.customFrom && saved.customTo
      ? { from: saved.customFrom, to: saved.customTo }
      : undefined;

  return {
    period,
    dateRange: getDateRangeForPeriod(period, custom),
    sellerName: saved.sellerName ?? null,
    customFrom: saved.customFrom,
    customTo: saved.customTo,
  };
}

export function formatCustomPeriodLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return `${fmt(from)} – ${fmt(to)}`;
}
