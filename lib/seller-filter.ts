/** Lê ?seller=Nome do vendedor (null = todos). */
export function parseSellerParam(searchParams: {
  get: (name: string) => string | null;
}): string | null {
  const raw = searchParams.get("seller")?.trim();
  return raw || null;
}
