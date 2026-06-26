import { supabase } from "@/lib/supabase";

const DEFAULT_VERSION = "v19.0";

export function normalizeAccountId(raw: string): string {
  return raw.trim().replace(/^act_/, "");
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function maskAccountId(accountId: string): string {
  const id = normalizeAccountId(accountId);
  if (id.length <= 4) return `act_****${id}`;
  return `act_****${id.slice(-4)}`;
}

export async function getMetaApiVersion(): Promise<string> {
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("api_version")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (account?.api_version?.trim()) {
    return account.api_version.trim().replace(/^v?/, "v");
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "meta_ads_api_version")
    .maybeSingle();

  if (!error && data?.value?.trim()) {
    return data.value.trim().replace(/^v?/, "v");
  }

  const fromEnv = process.env.META_ADS_API_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v?/, "v");

  return DEFAULT_VERSION;
}

export async function setMetaApiVersion(
  version: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = version.trim().replace(/^v?/, "v");
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "meta_ads_api_version",
      value: v,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    const hint = error.message.includes("app_settings")
      ? " Execute a migration supabase/migrations/003_app_settings.sql no Supabase."
      : "";
    return { ok: false, error: `${error.message}${hint}` };
  }

  return { ok: true };
}

interface MetaGraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/** Traduz erros comuns da Graph API para mensagens acionáveis em português. */
export function formatMetaApiError(error: MetaGraphError): string {
  const code = error.code;
  const msg = String(error.message ?? "Erro desconhecido na Meta API");
  const lower = msg.toLowerCase();

  if (
    code === 200 ||
    lower.includes("ads_read") ||
    lower.includes("ads_management") ||
    lower.includes("has not grant")
  ) {
    return (
      "O token não tem permissão ads_read nesta conta de anúncios. " +
      "No Business Manager: Configurações → Usuários → Usuários do sistema → " +
      "selecione o usuário → Adicione ativos → Contas de anúncio → marque ads_read (ou ads_management). " +
      "Gere um novo token com essa permissão e cole aqui. " +
      "Documentação: developers.facebook.com/docs/marketing-api/get-started/authorization"
    );
  }

  if (code === 190 || lower.includes("expired") || lower.includes("invalid oauth")) {
    return "Token expirado ou inválido. Gere um novo Access Token de longa duração no Business Manager.";
  }

  if (code === 100 && lower.includes("account")) {
    return "Account ID inválido ou inacessível com este token. Confira o act_XXXXX e se o token tem acesso a essa conta.";
  }

  if (code === 10 || lower.includes("permission")) {
    return `Permissão negada pela Meta: ${msg}`;
  }

  return msg;
}

export async function fetchMetaAccountInfo(
  accountId: string,
  accessToken: string,
  apiVersion?: string
): Promise<{
  name: string | null;
  currency: "BRL" | "USD";
  accountStatus: string | null;
  error: string | null;
}> {
  const version = apiVersion ?? (await getMetaApiVersion());
  const id = normalizeAccountId(accountId);
  const url =
    `https://graph.facebook.com/${version}/act_${id}` +
    `?fields=name,currency,account_status&access_token=${accessToken}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.error) {
      return {
        name: null,
        currency: "BRL",
        accountStatus: null,
        error: formatMetaApiError(data.error as MetaGraphError),
      };
    }
    const raw = String(data.currency ?? "").toUpperCase();
    const currency = raw === "USD" ? "USD" : "BRL";
    return {
      name: data.name ? String(data.name) : null,
      currency,
      accountStatus: data.account_status ? String(data.account_status) : null,
      error: null,
    };
  } catch (err) {
    return { name: null, currency: "BRL", accountStatus: null, error: String(err) };
  }
}

export async function testMetaAdsConnection(
  accountId: string,
  accessToken: string,
  apiVersion?: string
): Promise<{
  ok: boolean;
  name?: string;
  currency?: string;
  account_status?: string;
  error?: string;
}> {
  const info = await fetchMetaAccountInfo(accountId, accessToken, apiVersion);
  if (info.error) return { ok: false, error: info.error };
  return {
    ok: true,
    name: info.name ?? undefined,
    currency: info.currency,
    account_status: info.accountStatus ?? undefined,
  };
}

export async function testMetaAccount(
  accountId: string,
  accessToken: string,
  apiVersion?: string
): Promise<{ ok: boolean; message: string; metaName?: string }> {
  const info = await fetchMetaAccountInfo(accountId, accessToken, apiVersion);
  if (info.error) return { ok: false, message: info.error };
  return {
    ok: true,
    message: "Conexão OK",
    metaName: info.name ?? undefined,
  };
}

/** Resolve nome + moeda de cada account_id em paralelo via Graph API. */
export async function fetchAdAccountNames(
  accountIds: string[],
  accessToken: string,
  apiVersion?: string
): Promise<
  Array<{
    account_id: string;
    name: string | null;
    currency: "BRL" | "USD" | null;
    error: string | null;
  }>
> {
  const version = apiVersion ?? (await getMetaApiVersion());
  return Promise.all(
    accountIds.map(async (id) => {
      const normalized = normalizeAccountId(id);
      const url =
        `https://graph.facebook.com/${version}/act_${normalized}` +
        `?fields=name,currency&access_token=${accessToken}`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (data.error) {
          return {
            account_id: normalized,
            name: null,
            currency: null,
            error: String(data.error.message ?? "Erro Meta"),
          };
        }
        const raw = String(data.currency ?? "").toUpperCase();
        const currency = raw === "USD" ? "USD" : raw === "BRL" ? "BRL" : null;
        return {
          account_id: normalized,
          name: data.name ? String(data.name) : null,
          currency,
          error: null,
        };
      } catch (err) {
        return {
          account_id: normalized,
          name: null,
          currency: null,
          error: String(err),
        };
      }
    })
  );
}
