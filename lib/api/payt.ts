import type { PaymentRow } from "@/types";

export interface PaytMetrics {
  volume: number;
  transactions: number;
  variationPct: number;
}

export async function fetchPaytBreakdown(
  from: Date,
  to: Date
): Promise<PaymentRow[]> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`/api/dashboard/payments?${params}`);
  if (!res.ok) throw new Error("Falha ao buscar pagamentos Payt");
  const all: PaymentRow[] = await res.json();
  return all.filter((r) => r.gateway === "payt");
}
