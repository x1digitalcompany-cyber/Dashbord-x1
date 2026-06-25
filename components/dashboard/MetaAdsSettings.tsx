"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseJsonResponse } from "@/lib/parse-json-response";

interface AdAccountRow {
  id: string;
  accountId: string;
  accountName: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  tokenMasked: string;
}

interface HealthRow {
  id: string;
  accountId: string;
  accountName: string | null;
  status: "ok" | "error" | "inactive";
  message: string;
}

export function MetaAdsSettings() {
  const [accounts, setAccounts] = useState<AdAccountRow[]>([]);
  const [apiVersion, setApiVersion] = useState("v19.0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthRow[] | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    accountId: "",
    accessToken: "",
    currency: "BRL",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/ad-accounts");
      const data = await parseJsonResponse<{
        accounts?: AdAccountRow[];
        apiVersion?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar contas Meta");
      setAccounts(data.accounts ?? []);
      setApiVersion(data.apiVersion ?? "v19.0");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/dashboard/ad-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: form.accountId,
          accessToken: form.accessToken,
          currency: form.currency,
        }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");

      setSuccess("Conta Meta Ads salva com sucesso.");
      setForm({ accountId: "", accessToken: "", currency: "BRL" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta conta de anúncios?")) return;
    const res = await fetch(`/api/dashboard/ad-accounts/${id}`, { method: "DELETE" });
    const data = await parseJsonResponse<{ error?: string }>(res);
    if (!res.ok) {
      setError(data.error ?? "Falha ao remover");
      return;
    }
    setSuccess("Conta removida.");
    await load();
  }

  async function toggleActive(acc: AdAccountRow) {
    const res = await fetch(`/api/dashboard/ad-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !acc.isActive }),
    });
    const data = await parseJsonResponse<{ error?: string }>(res);
    if (!res.ok) {
      setError(data.error ?? "Falha ao atualizar");
      return;
    }
    await load();
  }

  async function runHealthCheck() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/ad-accounts/health");
      const data = await parseJsonResponse<{
        accounts?: HealthRow[];
        errors?: number;
        ok?: number;
        total?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha no teste");
      setHealth(data.accounts ?? []);
      if ((data.errors ?? 0) > 0) {
        setError(`${data.errors} conta(s) com erro de conexão.`);
      } else if ((data.total ?? 0) === 0) {
        setError("Nenhuma conta cadastrada.");
      } else {
        setSuccess(`${data.ok} conta(s) conectadas com sucesso.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setTesting(false);
    }
  }

  async function saveApiVersionOnly() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/dashboard/ad-accounts/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiVersion }),
      });
      const data = await parseJsonResponse<{ apiVersion?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar versão");
      setApiVersion(data.apiVersion ?? apiVersion);
      setSuccess("Versão da API atualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Megaphone size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Meta Ads (Facebook)
            </h2>
            <p className="text-sm text-gray-400">
              Contas e tokens para gasto com anúncios no dashboard
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runHealthCheck}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {testing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Testar conexão
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Versão da Graph API
          </label>
          <input
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="v19.0"
          />
        </div>
        <button
          type="button"
          onClick={saveApiVersionOnly}
          disabled={saving}
          className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
        >
          Salvar versão
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando contas…
        </div>
      ) : accounts.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">
          Nenhuma conta cadastrada. Adicione o Account ID e o Access Token da Meta.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {accounts.map((acc) => {
            const h = health?.find((x) => x.id === acc.id);
            return (
              <li
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {acc.accountName ?? `act_${acc.accountId}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    act_{acc.accountId} · {acc.currency} · Token: {acc.tokenMasked}
                  </p>
                  {h && (
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1 text-xs",
                        h.status === "ok"
                          ? "text-emerald-600"
                          : h.status === "error"
                            ? "text-red-500"
                            : "text-gray-400"
                      )}
                    >
                      {h.status === "ok" ? (
                        <CheckCircle2 size={12} />
                      ) : h.status === "error" ? (
                        <XCircle size={12} />
                      ) : null}
                      {h.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(acc)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium",
                      acc.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {acc.isActive ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(acc.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Remover"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Account ID
            </label>
            <input
              required
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              placeholder="act_123456789 ou só os dígitos"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Access Token (longa duração, permissão ads_read)
            </label>
            <div className="relative">
              <input
                required
                type={showToken ? "text" : "password"}
                value={form.accessToken}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accessToken: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-10 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Moeda
            </label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="BRL">BRL (Real)</option>
              <option value="USD">USD (Dólar)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Salvar conta
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setSuccess(null);
            setError(null);
          }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
        >
          <Plus size={16} />
          Adicionar conta Meta Ads
        </button>
      )}

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <p className="mb-2 font-medium">Como obter o token correto</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
          <li>
            Acesse{" "}
            <a
              href="https://business.facebook.com/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Business Manager → Configurações
            </a>
          </li>
          <li>
            Vá em <strong>Usuários → Usuários do sistema</strong> (recomendado) ou use um app com Marketing API
          </li>
          <li>
            Atribua a <strong>conta de anúncios</strong> ao usuário com permissão{" "}
            <strong>ads_read</strong> ou <strong>ads_management</strong>
          </li>
          <li>Gere o <strong>Access Token</strong> com escopo <code className="rounded bg-white/60 px-1">ads_read</code></li>
          <li>
            Cole o Account ID (<code className="rounded bg-white/60 px-1">act_…</code>) e o token no formulário acima
          </li>
        </ol>
        <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
          Erro (#200) = o token existe, mas não foi autorizado para ler essa conta. Gere um novo token após conceder a permissão.
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Os dados de gasto, impressões e cliques aparecem automaticamente nos KPIs
        financeiros e no dashboard principal.
      </p>
    </div>
  );
}
