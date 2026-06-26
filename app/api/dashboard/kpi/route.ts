import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseSellerParam } from "@/lib/seller-filter";
import type { KpiData } from "@/types";

const USD_BRL = Number(process.env.USD_BRL_FALLBACK_RATE ?? "5.4");

function prevPeriod(from: Date, to: Date) {
  const len = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - len), to: new Date(from.getTime()) };
}

function pct(curr: number, prev: number) {
  if (prev === 0) return 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function metaDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchMetaSpend(
  accountId: string,
  accessToken: string,
  currency: string,
  from: Date,
  to: Date
): Promise<number> {
  const url = new URL(`https://graph.facebook.com/v21.0/act_${accountId}/insights`);
  url.searchParams.set("fields", "spend");
  url.searchParams.set("time_range", JSON.stringify({ since: metaDate(from), until: metaDate(to) }));
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return 0;
  const json = await res.json();
  const spend = Number(json?.data?.[0]?.spend ?? 0);
  return currency === "USD" ? spend * USD_BRL : spend;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to   = new Date(searchParams.get("to")   ?? Date.now());
  const prev = prevPeriod(from, to);
  const sellerName = parseSellerParam(searchParams);

  try {
    const fromISO     = from.toISOString();
    const toISO       = to.toISOString();
    const prevFromISO = prev.from.toISOString();
    const prevToISO   = prev.to.toISOString();

    let agendQ = supabase.from("orders").select("id", { count: "exact", head: true })
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", fromISO).lte("created_at", toISO);
    if (sellerName) agendQ = agendQ.eq("seller_name", sellerName);

    let agendPrevQ = supabase.from("orders").select("id", { count: "exact", head: true })
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", prevFromISO).lte("created_at", prevToISO);
    if (sellerName) agendPrevQ = agendPrevQ.eq("seller_name", sellerName);

    let pagarmeQ = supabase.from("orders").select("value")
      .eq("gateway", "pagarme").eq("kanban_status", "pagos")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", fromISO).lte("created_at", toISO);
    if (sellerName) pagarmeQ = pagarmeQ.eq("seller_name", sellerName);

    let pagarmePrevQ = supabase.from("orders").select("value")
      .eq("gateway", "pagarme").eq("kanban_status", "pagos")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", prevFromISO).lte("created_at", prevToISO);
    if (sellerName) pagarmePrevQ = pagarmePrevQ.eq("seller_name", sellerName);

    let paytQ = supabase.from("orders").select("value")
      .eq("gateway", "payt").eq("kanban_status", "pagos")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", fromISO).lte("created_at", toISO);
    if (sellerName) paytQ = paytQ.eq("seller_name", sellerName);

    let paytPrevQ = supabase.from("orders").select("value")
      .eq("gateway", "payt").eq("kanban_status", "pagos")
      .neq("customer_email", "cliente@example.com")
      .not("customer_name", "ilike", "%cliente fict%")
      .gte("created_at", prevFromISO).lte("created_at", prevToISO);
    if (sellerName) paytPrevQ = paytPrevQ.eq("seller_name", sellerName);

    const [
      agendRes, agendPrevRes,
      pagarmeRes, pagarmePrevRes,
      paytRes, paytPrevRes,
      leadsRes, leadsPrevRes,
      adAccountsRes,
      adSpendRes, adSpendPrevRes,
    ] = await Promise.all([
      agendQ,
      agendPrevQ,
      pagarmeQ,
      pagarmePrevQ,
      paytQ,
      paytPrevQ,
      // Leads
      supabase.from("leads").select("id", { count: "exact", head: true })
        .gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("leads").select("id", { count: "exact", head: true })
        .gte("created_at", prevFromISO).lte("created_at", prevToISO),

      // Contas Meta para busca live
      supabase.from("ad_accounts").select("account_id, access_token, currency")
        .eq("platform", "meta").eq("is_active", true),

      // Ad spend manual (fallback / complemento)
      supabase.from("ad_spend").select("spend, currency")
        .gte("date", metaDate(from)).lte("date", metaDate(to)),
      supabase.from("ad_spend").select("spend, currency")
        .gte("date", metaDate(prev.from)).lte("date", metaDate(prev.to)),
    ]);

    // ── Agendamentos ──────────────────────────────────────────────────────────
    const currAgend = agendRes.count ?? 0;
    const prevAgend = agendPrevRes.count ?? 0;

    // ── Pagar.me ──────────────────────────────────────────────────────────────
    const pagarmeVol     = (pagarmeRes.data ?? []).reduce((s, r) => s + Number(r.value), 0);
    const pagarmePrevVol = (pagarmePrevRes.data ?? []).reduce((s, r) => s + Number(r.value), 0);
    const pagarmeCount   = pagarmeRes.data?.length ?? 0;

    // ── Payt ──────────────────────────────────────────────────────────────────
    const paytVol     = (paytRes.data ?? []).reduce((s, r) => s + Number(r.value), 0);
    const paytPrevVol = (paytPrevRes.data ?? []).reduce((s, r) => s + Number(r.value), 0);
    const paytCount   = paytRes.data?.length ?? 0;

    // ── Leads ─────────────────────────────────────────────────────────────────
    const leadsTotal = leadsRes.count ?? 0;
    const leadsPrev  = leadsPrevRes.count ?? 0;

    // ── Ads spend — Meta API live + fallback tabela ad_spend ─────────────────
    let adsSpend     = 0;
    let adsPrevSpend = 0;

    if (adAccountsRes.data?.length) {
      // Busca live via Meta Graph API
      const [currSums, prevSums] = await Promise.all([
        Promise.all(
          adAccountsRes.data.map((acc) =>
            fetchMetaSpend(acc.account_id, acc.access_token, acc.currency, from, to).catch(() => 0)
          )
        ),
        Promise.all(
          adAccountsRes.data.map((acc) =>
            fetchMetaSpend(acc.account_id, acc.access_token, acc.currency, prev.from, prev.to).catch(() => 0)
          )
        ),
      ]);
      adsSpend     = currSums.reduce((s, v) => s + v, 0);
      adsPrevSpend = prevSums.reduce((s, v) => s + v, 0);
    } else {
      // Fallback: soma da tabela ad_spend (valores em BRL)
      adsSpend     = (adSpendRes.data ?? []).reduce((s, r) => {
        const val = Number(r.spend);
        return s + (r.currency === "USD" ? val * USD_BRL : val);
      }, 0);
      adsPrevSpend = (adSpendPrevRes.data ?? []).reduce((s, r) => {
        const val = Number(r.spend);
        return s + (r.currency === "USD" ? val * USD_BRL : val);
      }, 0);
    }

    const cpl = leadsTotal > 0 ? adsSpend / leadsTotal : 0;

    const kpi: KpiData = {
      ads: {
        totalSpend:   adsSpend,
        variationPct: pct(adsSpend, adsPrevSpend),
      },
      leads: {
        total:        leadsTotal,
        cpl,
        variationPct: pct(leadsTotal, leadsPrev),
      },
      agendamentos: {
        total:          currAgend,
        conversionRate: leadsTotal > 0 ? Math.round((currAgend / leadsTotal) * 1000) / 10 : 0,
        variationPct:   pct(currAgend, prevAgend),
      },
      payt: {
        volume:       paytVol,
        transactions: paytCount,
        variationPct: pct(paytVol, paytPrevVol),
      },
      pagarme: {
        volume:       pagarmeVol,
        transactions: pagarmeCount,
        variationPct: pct(pagarmeVol, pagarmePrevVol),
      },
    };

    return NextResponse.json(kpi);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar KPIs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
