import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Lazy singleton — só cria o cliente quando chamado pela primeira vez em runtime.
// Evita falha de build na Vercel quando as env vars ainda não estão disponíveis
// na fase de análise estática.
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.DASHBOARD_SUPABASE_URL;
  const key = process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Configure DASHBOARD_SUPABASE_URL e DASHBOARD_SUPABASE_SERVICE_ROLE_KEY no .env.local (ou nas variáveis de ambiente da Vercel)"
    );
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Atalho para uso direto: supabase.from(...)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
