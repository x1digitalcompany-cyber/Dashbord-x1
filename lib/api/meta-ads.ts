/**
 * META ADS API — Documentação (espelhada do X1 Track Pro, somente leitura)
 * ─────────────────────────────────────────────────────────────────────────────
 * Referência: X1 track pro/src/lib/facebook-ads.ts
 *
 * ENDPOINT Graph API:
 *   GET https://graph.facebook.com/{version}/act_{account_id}/insights
 *
 * PARÂMETROS:
 *   - fields: campos separados por vírgula (spend, impressions, clicks, cpm, cpc,
 *     campaign_id, campaign_name, date_start, date_stop)
 *   - level: "campaign" | "adset" | "ad" (usamos "campaign" para totais e breakdown)
 *   - time_range: JSON string {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
 *   - time_increment: "1" para série diária (opcional)
 *   - access_token: token de longa duração com permissão ads_read
 *   - limit: "500"
 *
 * CREDENCIAIS (Dashboard X1):
 *   - Principal: Configurações → Meta Ads (tabela ad_accounts no Supabase)
 *   - Versão API: app_settings.meta_ads_api_version (padrão v19.0)
 *   - Fallback opcional: META_ADS_* no .env.local
 *
 * PERÍODO:
 *   - Datas no formato YYYY-MM-DD (America/Sao_Paulo implícito na API)
 *   - since/until inclusivos
 *
 * TRANSFORMAÇÃO:
 *   - spend/clicks/impressions vêm como strings → parseFloat/parseInt
 *   - Agregação por campanha somando spend/clicks/impressions
 *   - cpm = (spend / impressions) * 1000; cpc = spend / clicks
 *   - Contas USD convertidas para BRL via USD_BRL_FALLBACK_RATE
 *
 * CACHE:
 *   - 15 minutos em meta_ads_cache (Supabase) + revalidate Next fetch
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/lib/supabase";
import { getMetaApiVersion } from "@/lib/meta-account";

const USD_BRL = Number(process.env.USD_BRL_FALLBACK_RATE ?? "5.4");
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface MetaCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
}

export interface MetaDailyInsight {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface MetaAdsResult {
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  campaigns: MetaCampaignInsight[];
  daily: MetaDailyInsight[];
  currency: "BRL" | "USD";
  source: "meta_api" | "cache" | "ad_accounts";
  error?: string;
}

interface MetaAccountConfig {
  accountId: string;
  accessToken: string;
  currency: "BRL" | "USD";
}

interface RawInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start?: string;
  date_stop?: string;
}

async function graphVersion(): Promise<string> {
  return getMetaApiVersion();
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

function toBrl(value: number, currency: "BRL" | "USD"): number {
  return currency === "USD" ? value * USD_BRL : value;
}

function calcCpm(spend: number, impressions: number): number {
  return impressions > 0 ? (spend / impressions) * 1000 : 0;
}

function calcCpc(spend: number, clicks: number): number {
  return clicks > 0 ? spend / clicks : 0;
}

async function resolveAccounts(): Promise<MetaAccountConfig[]> {
  const { data } = await supabase
    .from("ad_accounts")
    .select("account_id, access_token, currency")
    .eq("platform", "meta")
    .eq("is_active", true);

  if (data?.length) {
    return data.map((row) => ({
      accountId: normalizeAccountId(row.account_id),
      accessToken: row.access_token,
      currency: row.currency === "USD" ? "USD" : "BRL",
    }));
  }

  const envToken = process.env.META_ADS_ACCESS_TOKEN?.trim();
  const envAccount = process.env.META_ADS_AD_ACCOUNT_ID?.trim();

  if (envToken && envAccount) {
    return [
      {
        accountId: normalizeAccountId(envAccount),
        accessToken: envToken,
        currency: "BRL",
      },
    ];
  }

  return [];
}

async function fetchInsights(
  account: MetaAccountConfig,
  since: string,
  until: string,
  level: "campaign" | "account" = "campaign",
  timeIncrement?: string
): Promise<RawInsightRow[]> {
  const fields =
    level === "account"
      ? "spend,impressions,clicks,date_start,date_stop"
      : "campaign_id,campaign_name,spend,impressions,clicks,date_start,date_stop";

  const params = new URLSearchParams({
    fields,
    level,
    time_range: JSON.stringify({ since, until }),
    access_token: account.accessToken,
    limit: "500",
  });
  if (timeIncrement) params.set("time_increment", timeIncrement);

  const url = `https://graph.facebook.com/${await graphVersion()}/act_${account.accountId}/insights?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (json.error) {
    const code = json.error.code;
    const msg = json.error.message ?? "Erro Meta Ads API";
    if (code === 190 || /expired|invalid.*token/i.test(msg)) {
      throw new Error(`Token Meta expirado ou inválido: ${msg}`);
    }
    if (code === 100 || /account/i.test(msg)) {
      throw new Error(`Conta de anúncios inválida (act_${account.accountId}): ${msg}`);
    }
    throw new Error(msg);
  }

  return json.data ?? [];
}

function aggregateCampaigns(
  rows: RawInsightRow[],
  currency: "BRL" | "USD"
): MetaCampaignInsight[] {
  const map = new Map<string, MetaCampaignInsight>();

  for (const row of rows) {
    const id = row.campaign_id ?? "unknown";
    const spend = toBrl(num(row.spend), currency);
    const impressions = num(row.impressions);
    const clicks = num(row.clicks);

    const existing = map.get(id);
    if (existing) {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.cpm = calcCpm(existing.spend, existing.impressions);
      existing.cpc = calcCpc(existing.spend, existing.clicks);
    } else {
      map.set(id, {
        campaign_id: id,
        campaign_name: row.campaign_name ?? "Sem nome",
        spend,
        impressions,
        clicks,
        cpm: calcCpm(spend, impressions),
        cpc: calcCpc(spend, clicks),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

function aggregateDaily(
  rows: RawInsightRow[],
  currency: "BRL" | "USD"
): MetaDailyInsight[] {
  const map = new Map<string, MetaDailyInsight>();

  for (const row of rows) {
    const date = row.date_start ?? row.date_stop ?? "";
    if (!date) continue;
    const spend = toBrl(num(row.spend), currency);
    const impressions = num(row.impressions);
    const clicks = num(row.clicks);

    const existing = map.get(date);
    if (existing) {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
    } else {
      map.set(date, { date, spend, impressions, clicks });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function readCache(from: Date, to: Date): Promise<MetaAdsResult | null> {
  const since = toMetaDate(from);
  const until = toMetaDate(to);
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data } = await supabase
    .from("meta_ads_cache")
    .select("data, fetched_at")
    .eq("period_from", since)
    .eq("period_to", until)
    .gte("fetched_at", cutoff)
    .maybeSingle();

  if (!data?.data) return null;
  return { ...(data.data as MetaAdsResult), source: "cache" };
}

async function writeCache(from: Date, to: Date, result: MetaAdsResult): Promise<void> {
  const since = toMetaDate(from);
  const until = toMetaDate(to);
  await supabase.from("meta_ads_cache").upsert(
    {
      period_from: since,
      period_to: until,
      data: result,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "period_from,period_to" }
  );
}

export async function fetchMetaAdsInsights(
  from: Date,
  to: Date,
  options?: { skipCache?: boolean }
): Promise<MetaAdsResult> {
  if (!options?.skipCache) {
    const cached = await readCache(from, to);
    if (cached) return cached;
  }

  const accounts = await resolveAccounts();
  if (!accounts.length) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      cpm: 0,
      cpc: 0,
      campaigns: [],
      daily: [],
      currency: "BRL",
      source: "meta_api",
      error:
        "Configure as contas Meta Ads em Configurações → Meta Ads (Account ID + Access Token).",
    };
  }

  const since = toMetaDate(from);
  const until = toMetaDate(to);

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  const allCampaigns: MetaCampaignInsight[] = [];
  const allDaily: MetaDailyInsight[] = [];
  let primaryCurrency: "BRL" | "USD" = "BRL";
  let source: MetaAdsResult["source"] = "ad_accounts";

  for (const account of accounts) {
    primaryCurrency = account.currency;
    const [campaignRows, dailyRows] = await Promise.all([
      fetchInsights(account, since, until, "campaign"),
      fetchInsights(account, since, until, "account", "1"),
    ]);

    const campaigns = aggregateCampaigns(campaignRows, account.currency);
    const daily = aggregateDaily(dailyRows, account.currency);

    for (const c of campaigns) {
      totalSpend += c.spend;
      totalImpressions += c.impressions;
      totalClicks += c.clicks;
      allCampaigns.push(c);
    }
    for (const d of daily) {
      const existing = allDaily.find((x) => x.date === d.date);
      if (existing) {
        existing.spend += d.spend;
        existing.impressions += d.impressions;
        existing.clicks += d.clicks;
      } else {
        allDaily.push({ ...d });
      }
    }
  }

  allDaily.sort((a, b) => a.date.localeCompare(b.date));

  const result: MetaAdsResult = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    cpm: calcCpm(totalSpend, totalImpressions),
    cpc: calcCpc(totalSpend, totalClicks),
    campaigns: allCampaigns.sort((a, b) => b.spend - a.spend),
    daily: allDaily,
    currency: primaryCurrency,
    source,
  };

  try {
    await writeCache(from, to, result);
  } catch {
    /* cache opcional */
  }

  return result;
}
