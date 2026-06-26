/**
 * Cotação USD→BRL ao vivo (AwesomeAPI), cache 1h — espelhado do X1 Track Pro.
 */
const FALLBACK_RATE = Number(process.env.USD_BRL_FALLBACK_RATE) || 5.4;

export async function getUsdToBrlRate(): Promise<number> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      next: { revalidate: 3600, tags: ["usd-brl-rate"] },
    } as RequestInit);
    const data = await res.json();
    const bid = parseFloat(data?.USDBRL?.bid);
    if (Number.isFinite(bid) && bid > 0) return bid;
  } catch (err) {
    console.error("[exchange-rate] USD-BRL fetch falhou, usando fallback:", err);
  }
  return FALLBACK_RATE;
}
