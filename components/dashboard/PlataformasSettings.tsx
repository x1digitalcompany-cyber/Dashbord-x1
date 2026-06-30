"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  Loader2,
  ShoppingCart,
  ExternalLink,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IntegrationInfo {
  url: string;
  active: boolean;
  lastReceived: {
    id: string | null;
    at: string;
    atFormatted: string;
    error?: string | null;
    status?: string;
  } | null;
}

interface IntegrationsData {
  secretConfigured: boolean;
  secretMasked: string | null;
  fiveAntecipado: IntegrationInfo;
  fiveAgendado: IntegrationInfo;
  payt: IntegrationInfo;
  braip: IntegrationInfo;
  x1company: IntegrationInfo;
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

function IntegrationCard({
  title,
  info,
  instructions,
}: {
  title: string;
  info: IntegrationInfo;
  instructions: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-5 dark:border-gray-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <Badge
          className={cn(
            "text-xs",
            info.active
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800"
          )}
        >
          {info.active ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-900">
          {info.url}
        </code>
        <CopyButton text={info.url} />
      </div>

      {info.lastReceived ? (
        <p className="mb-3 text-xs text-gray-500">
          Último recebimento: <strong>{info.lastReceived.id ?? "—"}</strong> em{" "}
          {info.lastReceived.atFormatted}
          {info.lastReceived.error && (
            <span className="text-red-500"> — erro: {info.lastReceived.error}</span>
          )}
        </p>
      ) : (
        <p className="mb-3 text-xs text-gray-400">Nenhum webhook recebido ainda.</p>
      )}

      <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700">
        {instructions}
      </div>
    </div>
  );
}

export function PlataformasSettings() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config/integrations");
      const json = await parseJsonResponse<IntegrationsData & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar integrações");
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

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/config/webhook-secret", { method: "POST" });
      const json = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao regenerar");
      setConfirmOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao regenerar");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Chave de Segurança */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950">
            <KeyRound size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Chave de Segurança
            </h2>
            <p className="text-sm text-gray-400">
              Sua chave única é usada para autenticar os webhooks de todas as plataformas
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              Chave atual:{" "}
              <code className="rounded bg-gray-100 px-2 py-0.5 text-sm dark:bg-gray-800">
                {data?.secretMasked ?? "não configurada"}
              </code>
            </p>
            <p className="mb-4 text-xs text-gray-500">
              Se você suspeitar que sua chave foi comprometida, regenere-a. Lembre-se de atualizar
              as URLs em todas as plataformas.
            </p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            >
              <RefreshCw size={14} />
              Regenerar Chave
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-4">
          <IntegrationCard
            title="Integração Five Antecipado"
            info={data.fiveAntecipado}
            instructions={
              <ol className="list-decimal space-y-1 pl-4">
                <li>Cole a URL completa do webhook na plataforma Five (antecipada)</li>
                <li>Método POST, formato JSON</li>
                <li>
                  O <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">?secret=</code> já
                  está incluso na URL
                </li>
              </ol>
            }
          />

          <IntegrationCard
            title="Integração Five Agendado"
            info={data.fiveAgendado}
            instructions={
              <ol className="list-decimal space-y-1 pl-4">
                <li>Cole a URL completa do webhook na plataforma Five (agendada / PayAfter)</li>
                <li>Método POST, formato JSON</li>
                <li>
                  O <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">?secret=</code> já
                  está incluso na URL
                </li>
              </ol>
            }
          />

          <IntegrationCard
            title="Integração Payt"
            info={data.payt}
            instructions={
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Acesse o painel da Payt em{" "}
                  <a
                    href="https://payt.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                  >
                    payt.com.br <ExternalLink size={10} />
                  </a>
                </li>
                <li>Vá em Minha Conta → Integrações ou Configurações → Postback</li>
                <li>Cole a URL acima no campo de URL de Postback</li>
                <li>Ative notificações para Pagamento aprovado e Reembolso</li>
                <li>Salve as configurações</li>
              </ol>
            }
          />

          <IntegrationCard
            title="Integração Braip"
            info={data.braip}
            instructions={
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Acesse o painel da Braip em{" "}
                  <a
                    href="https://braip.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                  >
                    braip.com <ExternalLink size={10} />
                  </a>
                </li>
                <li>Vá em Configurações → Integrações ou Webhooks</li>
                <li>Adicione uma nova integração de postback</li>
                <li>Cole a URL acima no campo de URL de Postback</li>
                <li>Selecione os eventos: Venda aprovada, Reembolso</li>
                <li>Salve as configurações</li>
              </ol>
            }
          />

          <IntegrationCard
            title="Integração X1Company"
            info={data.x1company}
            instructions={
              <ol className="list-decimal space-y-1 pl-4">
                <li>Acesse o painel da X1Company</li>
                <li>Vá em Configurações → Webhooks ou Postback</li>
                <li>Cole a URL acima no campo de URL de Postback</li>
                <li>Ative notificações para Pagamento aprovado e Reembolso</li>
                <li>Salve as configurações</li>
              </ol>
            }
          />
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Regenerar chave?">
        <p className="mb-6 text-sm text-gray-600">
          Isso vai invalidar todos os webhooks ativos. Você precisará atualizar as URLs na Five,
          Payt e Braip. Continuar?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {regenerating && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function PlataformasTabIcon() {
  return <ShoppingCart size={16} />;
}
