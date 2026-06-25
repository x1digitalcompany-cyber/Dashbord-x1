export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      `Servidor retornou resposta vazia (HTTP ${res.status}). Verifique se as migrations do Supabase foram executadas.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Resposta inválida do servidor (HTTP ${res.status}).`
    );
  }
}
