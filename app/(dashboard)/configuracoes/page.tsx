"use client";

import { useState } from "react";
import { Settings, ShoppingCart, Megaphone, Wrench, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { PlataformasSettings } from "@/components/dashboard/PlataformasSettings";
import { MetaAdsConfigPanel } from "@/components/dashboard/MetaAdsConfigPanel";
import { cn } from "@/lib/utils";

type MainTab = "plataformas" | "meta" | "manutencao";

interface ReprocessResult {
  ok: boolean;
  status_fixed: number;
  sellers_synced: number;
  errors: string[];
}

function ManutencaoPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReprocessResult | null>(null);

  async function handleReprocess() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/dashboard/admin/reprocess-orders", { method: "POST" });
      const data: ReprocessResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, status_fixed: 0, sellers_synced: 0, errors: ["Erro de rede ao contatar o servidor."] });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
            <RefreshCw size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Sincronização de Pedidos
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Normaliza status antigos, corrige tipos de pagamento ausentes e sincroniza vendedores a partir dos pedidos existentes na base.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="mb-2 font-medium text-amber-800 dark:text-amber-300">O que será executado:</p>
          <ul className="space-y-1 text-amber-700 dark:text-amber-400">
            <li>• Renomear status legados: <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">chegou</code> → <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">pedidos_criados</code> e similares</li>
            <li>• Corrigir pedidos antecipados com status <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">pagos</code> → <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">entregue</code></li>
            <li>• Preencher <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">payment_type</code> nulo com <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">agendado</code></li>
            <li>• Criar registros de vendedores para todos os nomes encontrados nos pedidos</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={handleReprocess}
          disabled={running}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            "bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <RefreshCw size={15} className={running ? "animate-spin" : ""} />
          {running ? "Processando..." : "Executar Sincronização"}
        </button>

        {result && (
          <div
            className={cn(
              "mt-4 rounded-xl border p-4 text-sm",
              result.ok
                ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/20"
                : "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20"
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              {result.ok ? (
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
              )}
              <span className={cn("font-medium", result.ok ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
                {result.ok ? "Sincronização concluída com sucesso" : "Sincronização concluída com erros"}
              </span>
            </div>
            <ul className="space-y-1 text-gray-700 dark:text-gray-300">
              <li>✓ Tipos de status verificados/corrigidos: <strong>{result.status_fixed}</strong></li>
              <li>✓ Pedidos antecipados ajustados</li>
              <li>✓ Tipos de pagamento preenchidos</li>
              <li>✓ Vendedores sincronizados: <strong>{result.sellers_synced}</strong></li>
              {result.errors.length > 0 && (
                <li className="mt-2 text-red-600 dark:text-red-400">
                  ⚠ {result.errors.join(" | ")}
                </li>
              )}
            </ul>
            {result.ok && (
              <p className="mt-3 text-xs text-gray-500">
                Se os dados ainda aparecerem zerados, verifique o período selecionado no Dashboard — os pedidos podem ter datas anteriores ao filtro padrão de 30 dias.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">SQL de Diagnóstico</h2>
        <p className="mb-3 text-sm text-gray-500">
          Execute no Supabase → SQL Editor para inspecionar o estado atual dos pedidos:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-200 dark:bg-gray-900">
{`-- Distribuição atual de status + tipo de pagamento
SELECT kanban_status, payment_type, COUNT(*) AS total
FROM orders
GROUP BY kanban_status, payment_type
ORDER BY total DESC;

-- Pedidos sem seller_name
SELECT COUNT(*) AS sem_vendedor FROM orders
WHERE seller_name IS NULL OR seller_name = '';

-- Pedidos sem payment_type
SELECT COUNT(*) AS sem_tipo FROM orders WHERE payment_type IS NULL;

-- Pedidos nos últimos 30 dias vs total
SELECT
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS ultimos_30_dias,
  COUNT(*) AS total_geral
FROM orders;`}
        </pre>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<MainTab>("plataformas");

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950">
            <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configurações
            </h1>
            <p className="text-sm text-gray-400">
              Integrações de vendas, Meta Ads e manutenção
            </p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl border border-gray-200 p-1 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setTab("plataformas")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "plataformas"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <ShoppingCart size={16} />
            Plataformas de Vendas
          </button>
          <button
            type="button"
            onClick={() => setTab("meta")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "meta"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Megaphone size={16} />
            Meta Ads
          </button>
          <button
            type="button"
            onClick={() => setTab("manutencao")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "manutencao"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Wrench size={16} />
            Manutenção
          </button>
        </div>
      </div>

      {tab === "plataformas" && <PlataformasSettings />}
      {tab === "meta" && <MetaAdsConfigPanel />}
      {tab === "manutencao" && <ManutencaoPanel />}
    </div>
  );
}
