"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Webhook, Loader2, Play } from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { formatDatetime } from "@/lib/utils";

interface WebhookInfo {
  url: string;
  secretConfigured: boolean;
  lastReceived: {
    orderNumber: string | null;
    at: string;
    error: string | null;
  } | null;
}

interface WebhooksData {
  antecipado: WebhookInfo;
  agendado: WebhookInfo;
  legacyUrl: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700"
      title="Copiar URL"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

function WebhookCard({
  label,
  info,
  onTest,
  testing,
}: {
  label: string;
  info: WebhookInfo;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <span
          className={`text-xs ${info.secretConfigured ? "text-emerald-600" : "text-amber-600"}`}
        >
          {info.secretConfigured ? "Secret configurado" : "Secret ausente no .env.local"}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-900">
          {info.url}
        </code>
        <CopyButton text={info.url} />
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Header: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">X-Five-Secret</code>{" "}
        com o valor de <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">FIVE_WEBHOOK_SECRET_*</code>
      </p>

      {info.lastReceived ? (
        <p className="text-xs text-gray-500">
          Último recebimento:{" "}
          <strong>{info.lastReceived.orderNumber ?? "—"}</strong> em{" "}
          {formatDatetime(info.lastReceived.at)}
          {info.lastReceived.error && (
            <span className="text-red-500"> — erro: {info.lastReceived.error}</span>
          )}
        </p>
      ) : (
        <p className="text-xs text-gray-400">Nenhum webhook recebido ainda.</p>
      )}

      <button
        type="button"
        onClick={onTest}
        disabled={testing}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700"
      >
        {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        Testar webhook
      </button>
    </div>
  );
}

export function WebhooksSettings() {
  const [data, setData] = useState<WebhooksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState<"antecipado" | "agendado" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/webhooks");
      const json = await parseJsonResponse<WebhooksData & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar webhooks");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testWebhook(source: "antecipado" | "agendado") {
    setTesting(source);
    setTestResult(null);
    try {
      const res = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const json = await parseJsonResponse<{ status: number; response: unknown }>(res);
      setTestResult(
        `HTTP ${json.status}: ${JSON.stringify(json.response, null, 2)}`
      );
      await load();
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950">
          <Webhook size={20} className="text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Webhooks Five</h2>
          <p className="text-sm text-gray-400">Duas operações — URLs separadas na plataforma Five</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando…
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {data && (
        <div className="space-y-4">
          <WebhookCard
            label="Five Antecipada"
            info={data.antecipado}
            testing={testing === "antecipado"}
            onTest={() => testWebhook("antecipado")}
          />
          <WebhookCard
            label="Five Agendada (PayAfter)"
            info={data.agendado}
            testing={testing === "agendado"}
            onTest={() => testWebhook("agendado")}
          />

          <p className="text-xs text-gray-400">
            Legado (sem secret): <code>{data.legacyUrl}</code>
          </p>

          {testResult && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900">
              {testResult}
            </pre>
          )}

          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700">
            <p className="mb-1 font-medium text-gray-700 dark:text-gray-300">Na plataforma Five:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Cole a URL do webhook correspondente à operação</li>
              <li>Método POST, formato JSON</li>
              <li>Adicione header <code>X-Five-Secret</code> com o secret do .env.local</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
