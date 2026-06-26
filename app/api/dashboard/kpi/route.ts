import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseFromToParams } from "@/lib/period";
import { parseSellerParam } from "@/lib/seller-filter";
import { fetchMetaAdsInsights } from "@/lib/api/meta-ads";
import type { KpiData } from "@/types";

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { from, to } = parseFromToParams(searchParams);
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
      adSpendRes, adSpendPrevRes,
    ] = await Promise.all([
      agendQ,
      agendPrevQ,
      pagarmeQ,
      pagarmePrevQ,
      paytQ,
      paytPrevQ,
      supabase.from("leads").select("id", { count: "exact", head: true })
        .gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("leads").select("id", { count: "exact", head: true })
        .gte("created_at", prevFromISO).lte("created_at", prevToISO),
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

    // ── Ads spend — Meta API via lib/api/meta-ads (v19.0) ───────────────────
    const [metaCurr, metaPrev] = await Promise.all([
      fetchMetaAdsInsights(from, to).catch(() => null),
      fetchMetaAdsInsights(prev.from, prev.to).catch(() => null),
    ]);

    let adsSpend = metaCurr?.spend ?? 0;
    let adsPrevSpend = metaPrev?.spend ?? 0;
    let metaLeads = metaCurr?.leads ?? 0;
    let metaLeadsPrev = metaPrev?.leads ?? 0;

    if (metaCurr?.mock) {
      adsSpend = (adSpendRes.data ?? []).reduce((s, r) => {
        const val = Number(r.spend);
        return s + (r.currency === "USD" ? val * Number(process.env.USD_BRL_FALLBACK_RATE ?? "5.4") : val);
      }, 0);
      adsPrevSpend = (adSpendPrevRes.data ?? []).reduce((s, r) => {
        const val = Number(r.spend);
        return s + (r.currency === "USD" ? val * Number(process.env.USD_BRL_FALLBACK_RATE ?? "5.4") : val);
      }, 0);
      metaLeads = leadsTotal;
      metaLeadsPrev = leadsPrev;
    }

    const leadsForCpl = metaLeads > 0 ? metaLeads : leadsTotal;
    const leadsPrevForCpl = metaLeadsPrev > 0 ? metaLeadsPrev : leadsPrev;
    const cpl = leadsForCpl > 0 ? adsSpend / leadsForCpl : 0;

    const kpi: KpiData = {
      ads: {
        totalSpend:   adsSpend,
        variationPct: pct(adsSpend, adsPrevSpend),
      },
      leads: {
        total:        metaLeads > 0 ? metaLeads : leadsTotal,
        cpl,
        variationPct: pct(metaLeads > 0 ? metaLeads : leadsTotal, metaLeadsPrev > 0 ? metaLeadsPrev : leadsPrev),
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
