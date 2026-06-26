/**
 * META ADS API — Dashboard X1 (espelhado do X1 Track Pro + extensões)
 * ─────────────────────────────────────────────────────────────────────────────
 * Referência: X1 track pro/src/lib/facebook-ads.ts + queries.ts
 *
 * CONEXÃO:
 *   - fetch nativo (sem SDK Meta)
 *   - Graph API v19.0 (app_settings.meta_ads_api_version ou META_ADS_API_VERSION)
 *   - Credenciais: tabela ad_accounts (is_active=true) — configuradas em /configuracoes
 *   - account_id SEM prefixo act_; URL usa act_{account_id}
 *
 * ENDPOINTS:
 *   GET /{version}/act_{id}/insights
 *     fields: spend, impressions, clicks, reach, cpm, cpc, ctr, actions, action_values,
 *             campaign_id, campaign_name, date_start, date_stop
 *     level: account | campaign
 *     time_range: {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
 *     time_increment: "1" (série diária)
 *     limit: 500 (sem paginação cursor)
 *
 *   GET /{version}/act_{id}/campaigns?fields=id,name,status
 *
 * LEADS/PURCHASES:
 *   - leads extraídos de actions: "lead", "onsite_conversion.lead_grouped"
 *   - purchases de actions: "purchase", "offsite_conversion.fb_pixel_purchase"
 *   - ROAS de action_values purchase / spend
 *
 * IMPOSTO META 12.5%:
 *   - Aplicado só em contas BRL (META_TAX_RATE), igual Track Pro
 *
 * USD:
 *   - Contas USD convertidas via getUsdToBrlRate() antes de agregar
 *
 * CACHE:
 *   - Supabase meta_ads_cache, TTL 15 min (expires_at + cache_key)
 *
 * ERROS:
 *   - 190 → token expirado
 *   - 17  → rate limit, retry 2x com 60s
 *   - 100 → parâmetro/conta inválida → zeros + error flag
 *   - 200 → permissão ads_read
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/lib/supabase";
import { getUsdToBrlRate } from "@/lib/exchange-rate";
import { formatMetaApiError, getMetaApiVersion } from "@/lib/meta-account";
import { round2, safeDivide } from "@/lib/finance";

export const META_TAX_RATE = 0.125;
const CACHE_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WAIT_MS = 60_000;
const RATE_LIMIT_RETRIES = 2;

const LEAD_ACTION_TYPES = new Set(["lead", "onsite_conversion.lead_grouped"]);
const PURCHASE_ACTION_TYPES = new Set([
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
]);

export interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  percentual_gasto?: number;
}

export interface MetaDailyRow {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface MetaAdsData {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  leads: number;
  cpl: number;
  purchases: number;
  cpa: number;
  roas: number;
  campaigns: MetaCampaignRow[];
  daily: MetaDailyRow[];
  currency: string;
  date_start: string;
  date_stop: string;
  fetched_at: string;
  mock?: boolean;
  configured?: boolean;
  error?: string;
  accountErrors?: string[];
  source?: "meta_api" | "cache" | "mock";
}

/** @deprecated use MetaAdsData */
export type MetaAdsResult = MetaAdsData;

interface MetaAccountConfig {
  accountId: string;
  accessToken: string;
  currency: "BRL" | "USD";
}

interface MetaAction {
  action_type: string;
  value: string;
}

interface RawInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

interface GraphError {
  message?: string;
  code?: number;
  type?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAccountId(raw: string): string {
  return raw.trim().replace(/^act_/, "");
}

function toMetaDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function num(value: string | undefined): number {
  const n = parseFloat(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function int(value: string | undefined): number {
  const n = parseInt(value ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function extractLeads(actions?: MetaAction[]): number {
  if (!actions?.length) return 0;
  return actions
    .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
    .reduce((s, a) => s + int(a.value), 0);
}

function extractPurchases(actions?: MetaAction[]): number {
  if (!actions?.length) return 0;
  return actions
    .filter((a) => PURCHASE_ACTION_TYPES.has(a.action_type))
    .reduce((s, a) => s + int(a.value), 0);
}

function extractPurchaseValue(actionValues?: MetaAction[]): number {
  if (!actionValues?.length) return 0;
  return actionValues
    .filter((a) => PURCHASE_ACTION_TYPES.has(a.action_type))
    .reduce((s, a) => s + num(a.value), 0);
}

function applyMetaTax(spendBrl: number, currency: "BRL" | "USD"): number {
  if (currency !== "BRL") return spendBrl;
  return spendBrl * (1 + META_TAX_RATE);
}

function calcCpm(spend: number, impressions: number): number {
  return impressions > 0 ? (spend / impressions) * 1000 : 0;
}

function calcCpc(spend: number, clicks: number): number {
  return clicks > 0 ? spend / clicks : 0;
}

function calcCtr(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

function cacheKeyFor(since: string, until: string, accountId?: string): string {
  const acc = accountId ?? "all";
  return `meta_ads_${acc}_${since}_${until}`;
}

export async function isMetaAdsConfigured(): Promise<boolean> {
  return (await resolveAccounts()).length > 0;
}

export async function resolveAccounts(): Promise<MetaAccountConfig[]> {
  const { data } = await supabase
    .from("ad_accounts")
    .select("account_id, access_token, currency")
    .eq("is_active", true);

  if (!data?.length) return [];

  return data.map((row) => ({
    accountId: normalizeAccountId(row.account_id),
    accessToken: row.access_token,
    currency: row.currency === "USD" ? "USD" : "BRL",
  }));
}

async function graphVersion(): Promise<string> {
  return getMetaApiVersion();
}

async function graphGet<T = unknown>(
  url: string,
  retries = RATE_LIMIT_RETRIES
): Promise<{ data: T | null; error: GraphError | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as { data?: T; error?: GraphError };
      if (json.error) {
        if (json.error.code === 17 && attempt < retries) {
          await sleep(RATE_LIMIT_WAIT_MS);
          continue;
        }
        return { data: null, error: json.error };
      }
      return { data: (json.data ?? json) as T, error: null };
    } catch (err) {
      if (attempt < retries) {
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      return { data: null, error: { message: String(err) } };
    }
  }
  return { data: null, error: { message: "Rate limit Meta Ads" } };
}

function handleGraphError(error: GraphError): never {
  const code = error.code;
  const msg = formatMetaApiError(error);
  if (code === 190) {
    throw new Error("Token do Meta Ads expirado. Acesse as configurações para renovar.");
  }
  if (code === 100) {
    throw new Error(msg);
  }
  throw new Error(msg);
}

const INSIGHT_FIELDS =
  "spend,impressions,clicks,reach,cpm,cpc,ctr,actions,action_values,campaign_id,campaign_name,date_start,date_stop";

const ACCOUNT_INSIGHT_FIELDS =
  "spend,impressions,clicks,reach,cpm,cpc,ctr,actions,action_values,date_start,date_stop";

async function fetchInsightsRaw(
  account: MetaAccountConfig,
  since: string,
  until: string,
  level: "campaign" | "account",
  timeIncrement?: string
): Promise<RawInsightRow[]> {
  const params = new URLSearchParams({
    fields: level === "account" ? ACCOUNT_INSIGHT_FIELDS : INSIGHT_FIELDS,
    level,
    time_range: JSON.stringify({ since, until }),
    access_token: account.accessToken,
    limit: "500",
  });
  if (timeIncrement) params.set("time_increment", timeIncrement);

  const version = await graphVersion();
  const url = `https://graph.facebook.com/${version}/act_${account.accountId}/insights?${params}`;
  const { data, error } = await graphGet<RawInsightRow[]>(url);

  if (error) {
    if (error.code === 100) {
      console.error("[meta-ads] insights param error:", error.message);
      return [];
    }
    handleGraphError(error);
  }
  return data ?? [];
}

export async function fetchCampaignStatuses(
  account: MetaAccountConfig
): Promise<Map<string, string>> {
  const version = await graphVersion();
  const url =
    `https://graph.facebook.com/${version}/act_${account.accountId}/campaigns` +
    `?fields=id,name,status&limit=500&access_token=${account.accessToken}`;

  const { data, error } = await graphGet<Array<{ id: string; status: string }>>(url);
  if (error || !data) return new Map();

  const map = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    map.set(row.id, row.status ?? "UNKNOWN");
  }
  return map;
}

interface NormalizedRow {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  campaign_id?: string;
  campaign_name?: string;
  date?: string;
}

function normalizeRow(
  row: RawInsightRow,
  currency: "BRL" | "USD",
  usdRate: number
): NormalizedRow {
  let spend = num(row.spend);
  if (currency === "USD") spend *= usdRate;
  spend = applyMetaTax(spend, currency);

  return {
    spend,
    impressions: int(row.impressions),
    clicks: int(row.clicks),
    reach: int(row.reach),
    leads: extractLeads(row.actions),
    purchases: extractPurchases(row.actions),
    purchaseValue: extractPurchaseValue(row.action_values),
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    date: row.date_start ?? row.date_stop,
  };
}

function emptyMetaData(since: string, until: string, opts?: Partial<MetaAdsData>): MetaAdsData {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    cpm: 0,
    cpc: 0,
    ctr: 0,
    leads: 0,
    cpl: 0,
    purchases: 0,
    cpa: 0,
    roas: 0,
    campaigns: [],
    daily: [],
    currency: "BRL",
    date_start: since,
    date_stop: until,
    fetched_at: new Date().toISOString(),
    ...opts,
  };
}

async function readCache(since: string, until: string): Promise<MetaAdsData | null> {
  const key = cacheKeyFor(since, until);
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("meta_ads_cache")
    .select("data, fetched_at, expires_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (!data?.data) {
    const { data: legacy } = await supabase
      .from("meta_ads_cache")
      .select("data, fetched_at, expires_at")
      .eq("period_from", since)
      .eq("period_to", until)
      .gte("fetched_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .maybeSingle();
    if (!legacy?.data) return null;
    return { ...(legacy.data as MetaAdsData), source: "cache" };
  }

  if (data.expires_at && data.expires_at < now) return null;
  return { ...(data.data as MetaAdsData), source: "cache" };
}

async function writeCache(since: string, until: string, result: MetaAdsData): Promise<void> {
  const key = cacheKeyFor(since, until);
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);

  await supabase.from("meta_ads_cache").upsert(
    {
      period_from: since,
      period_to: until,
      cache_key: key,
      data: result,
      fetched_at: fetchedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "cache_key" }
  );

  await supabase
    .from("ad_accounts")
    .update({ last_fetch_at: fetchedAt.toISOString() })
    .eq("is_active", true);
}

export async function getLastMetaFetchAt(): Promise<string | null> {
  const { data } = await supabase
    .from("meta_ads_cache")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.fetched_at ?? null;
}

async function buildFromAccounts(since: string, until: string): Promise<MetaAdsData> {
  const accounts = await resolveAccounts();
  const usdRate = await getUsdToBrlRate();

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalReach = 0;
  let totalLeads = 0;
  let totalPurchases = 0;
  let totalPurchaseValue = 0;
  const campaignMap = new Map<string, MetaCampaignRow>();
  const dailyMap = new Map<string, MetaDailyRow>();
  const statusMaps: Map<string, string>[] = [];

  const accountErrors: string[] = [];

  for (const account of accounts) {
    try {
      const [campaignRows, dailyRows, accountRows, statuses] = await Promise.all([
        fetchInsightsRaw(account, since, until, "campaign"),
        fetchInsightsRaw(account, since, until, "account", "1"),
        fetchInsightsRaw(account, since, until, "account"),
        fetchCampaignStatuses(account),
      ]);
      statusMaps.push(statuses);

      if (accountRows.length === 1) {
        const n = normalizeRow(accountRows[0], account.currency, usdRate);
        totalSpend += n.spend;
        totalImpressions += n.impressions;
        totalClicks += n.clicks;
        totalReach += n.reach;
        totalLeads += n.leads;
        totalPurchases += n.purchases;
        totalPurchaseValue += n.purchaseValue;
      }

      for (const raw of campaignRows) {
        const n = normalizeRow(raw, account.currency, usdRate);
        const id = n.campaign_id ?? "unknown";
        const cur = campaignMap.get(id);
        if (cur) {
          cur.spend += n.spend;
          cur.impressions += n.impressions;
          cur.clicks += n.clicks;
          cur.leads += n.leads;
          cur.cpl = cur.leads > 0 ? cur.spend / cur.leads : 0;
        } else {
          campaignMap.set(id, {
            id,
            name: n.campaign_name ?? "Sem nome",
            status: statuses.get(id) ?? "UNKNOWN",
            spend: n.spend,
            impressions: n.impressions,
            clicks: n.clicks,
            leads: n.leads,
            cpl: n.leads > 0 ? n.spend / n.leads : 0,
          });
        }
      }

      for (const raw of dailyRows) {
        const n = normalizeRow(raw, account.currency, usdRate);
        const date = n.date ?? "";
        if (!date) continue;
        const cur = dailyMap.get(date);
        if (cur) {
          cur.spend += n.spend;
          cur.impressions += n.impressions;
          cur.clicks += n.clicks;
          cur.leads += n.leads;
        } else {
          dailyMap.set(date, {
            date,
            spend: n.spend,
            impressions: n.impressions,
            clicks: n.clicks,
            leads: n.leads,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      accountErrors.push(`act_${account.accountId}: ${msg}`);
      console.error(`[meta-ads] conta act_${account.accountId} falhou:`, msg);
    }
  }

  const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.spend - a.spend);
  for (const c of campaigns) {
    c.percentual_gasto = totalSpend > 0 ? round2((c.spend / totalSpend) * 100) : 0;
    for (const sm of statusMaps) {
      if (sm.has(c.id)) {
        c.status = sm.get(c.id)!;
        break;
      }
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    spend: round2(totalSpend),
    impressions: totalImpressions,
    clicks: totalClicks,
    reach: totalReach,
    cpm: round2(calcCpm(totalSpend, totalImpressions)),
    cpc: round2(calcCpc(totalSpend, totalClicks)),
    ctr: round2(calcCtr(totalClicks, totalImpressions)),
    leads: totalLeads,
    cpl: round2(safeDivide(totalSpend, totalLeads)),
    purchases: totalPurchases,
    cpa: round2(safeDivide(totalSpend, totalPurchases)),
    roas: round2(safeDivide(totalPurchaseValue, totalSpend)),
    campaigns,
    daily,
    currency: "BRL",
    date_start: since,
    date_stop: until,
    fetched_at: new Date().toISOString(),
    source: "meta_api",
    ...(accountErrors.length > 0 ? { accountErrors } : {}),
  };
}

export async function fetchMetaAdsInsights(
  from: Date,
  to: Date,
  options?: { skipCache?: boolean }
): Promise<MetaAdsData> {
  const since = toMetaDate(from);
  const until = toMetaDate(to);

  if (!options?.skipCache) {
    const cached = await readCache(since, until);
    if (cached) return cached;
  }

  const accounts = await resolveAccounts();
  if (!accounts.length) {
    return emptyMetaData(since, until, {
      mock: true,
      configured: false,
      source: "mock",
      error:
        "Configure a conta Meta Ads em Configurações → Meta Ads (Account ID + Access Token).",
    });
  }

  try {
    const result = await buildFromAccounts(since, until);
    try {
      await writeCache(since, until, result);
    } catch {
      /* cache opcional */
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro Meta Ads API";
    return emptyMetaData(since, until, {
      configured: true,
      error: message,
      source: "meta_api",
    });
  }
}

export async function fetchMetaAdsDailyInsights(
  from: Date,
  to: Date
): Promise<MetaDailyRow[]> {
  const data = await fetchMetaAdsInsights(from, to);
  return data.daily;
}

export async function fetchMetaAdsCampaigns(
  from: Date,
  to: Date
): Promise<MetaCampaignRow[]> {
  const data = await fetchMetaAdsInsights(from, to);
  return data.campaigns;
}
