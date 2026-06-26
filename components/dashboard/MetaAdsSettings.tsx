"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseJsonResponse } from "@/lib/parse-json-response";

type ConnectionStatus = "connected" | "not_configured" | "token_expired";

interface SavedAccount {
  id: string;
  accountId: string;
  accountIdMasked: string;
  name: string | null;
  currency: string;
  apiVersion: string;
  tokenMasked: string;
  lastFetchAt: string | null;
}

interface TestResult {
  ok: boolean;
  name?: string;
  currency?: string;
  account_status?: string;
  error?: string;
}

const API_VERSIONS = ["v19.0", "v20.0", "v21.0"];

export function MetaAdsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("not_configured");
  const [savedAccount, setSavedAccount] = useState<SavedAccount | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testPassed, setTestPassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    accountId: "",
    accessToken: "",
    name: "",
    apiVersion: "v19.0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/meta-ads/account");
      const data = await parseJsonResponse<{
        account?: SavedAccount | null;
        lastFetchAt?: string | null;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar conta Meta");

      setSavedAccount(data.account ?? null);
      setLastFetchAt(data.account?.lastFetchAt ?? data.lastFetchAt ?? null);
      setConnectionStatus(data.account ? "connected" : "not_configured");

      if (data.account) {
        setForm((f) => ({
          ...f,
          accountId: data.account!.accountId,
          name: data.account!.name ?? "",
          apiVersion: data.account!.apiVersion ?? "v19.0",
          accessToken: "",
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetTest() {
    setTestResult(null);
    setTestPassed(false);
  }

  function onFieldChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    resetTest();
    setSuccess(null);
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);
    setTestPassed(false);

    const token = form.accessToken.trim();
    if (!form.accountId.trim() || !token) {
      setError("Preencha Account ID e Access Token para testar.");
      setTesting(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        account_id: form.accountId.trim(),
        access_token: token,
        api_version: form.apiVersion,
      });
      const res = await fetch(`/api/dashboard/meta-ads/test?${params}`);
      const data = await parseJsonResponse<TestResult>(res);
      setTestResult(data);
      if (data.ok) {
        setTestPassed(true);
        if (data.name && !form.name) {
          setForm((f) => ({ ...f, name: data.name! }));
        }
      } else {
        setError(data.error ?? "Falha no teste de conexão");
        if (/expirad|invalid oauth|190/i.test(data.error ?? "")) {
          setConnectionStatus("token_expired");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!testPassed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/dashboard/meta-ads/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: form.accountId.trim(),
          access_token: form.accessToken.trim(),
          name: form.name.trim() || undefined,
          api_version: form.apiVersion,
        }),
      });
      const data = await parseJsonResponse<{ account?: SavedAccount; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");

      setSuccess("Conta Meta Ads salva com sucesso.");
      setConnectionStatus("connected");
      setTestPassed(false);
      setTestResult(null);
      setForm((f) => ({ ...f, accessToken: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remover a conta Meta Ads? Os dados de anúncios deixarão de ser exibidos.")) {
      return;
    }
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/meta-ads/account", { method: "DELETE" });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao remover");

      setSuccess("Conta removida.");
      setSavedAccount(null);
      setConnectionStatus("not_configured");
      setForm({ accountId: "", accessToken: "", name: "", apiVersion: "v19.0" });
      resetTest();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setRemoving(false);
    }
  }

  const statusBanner = {
    connected: {
      label: "Conectado",
      dot: "bg-emerald-500",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    },
    not_configured: {
      label: "Não configurado",
      dot: "bg-amber-500",
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    },
    token_expired: {
      label: "Token expirado",
      dot: "bg-red-500",
      className:
        "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
    },
  }[connectionStatus];

  function formatFetchDate(iso: string | null) {
    if (!iso) return "Nunca";
    return new Date(iso).toLocaleString("pt-BR");
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
          <Megaphone size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Meta Ads</h2>
          <p className="text-sm text-gray-400">
            Credenciais salvas no banco — configure aqui, sem variáveis de ambiente
          </p>
        </div>
      </div>

      <div
        className={cn(
          "mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
          statusBanner.className
        )}
      >
        <span className="flex items-center gap-2 font-medium">
          <span className={cn("h-2 w-2 rounded-full", statusBanner.dot)} />
          {statusBanner.label}
          {connectionStatus === "connected" && " ✅"}
        </span>
        <span className="text-xs opacity-90">Último fetch: {formatFetchDate(lastFetchAt)}</span>
      </div>

      {savedAccount && (
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {savedAccount.name ?? "Conta Meta Ads"}
          </p>
          <p className="text-xs text-gray-500">
            {savedAccount.accountIdMasked} · {savedAccount.currency} · Token:{" "}
            {savedAccount.tokenMasked}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 whitespace-pre-wrap">
          🔴 {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Account ID</label>
            <input
              value={form.accountId}
              onChange={(e) => onFieldChange("accountId", e.target.value)}
              placeholder="123456789"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <p className="mt-1 text-xs text-gray-400">Sem o prefixo act_ — só os números</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Access Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={form.accessToken}
                onChange={(e) => onFieldChange("accessToken", e.target.value)}
                placeholder={
                  savedAccount ? "Deixe em branco para manter o token salvo" : "Cole o token aqui"
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
            <p className="mt-1 text-xs text-gray-400">
              Token de usuário do sistema — não expira
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Nome da conta (opcional)
            </label>
            <input
              value={form.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="Minha conta de anúncios"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Versão da API</label>
            <select
              value={form.apiVersion}
              onChange={(e) => onFieldChange("apiVersion", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {API_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {testResult?.ok && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✅ Conta encontrada: {testResult.name} ({testResult.currency})
              {testResult.account_status && ` · Status: ${testResult.account_status}`}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
            >
              {testing && <Loader2 size={14} className="animate-spin" />}
              Testar conexão
            </button>
            <button
              type="submit"
              disabled={saving || !testPassed}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
            {savedAccount && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remover conta
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <p className="mb-2 font-medium">✅ Como gerar o token que não expira:</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
          <li>
            Acesse{" "}
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              business.facebook.com
            </a>
          </li>
          <li>
            <strong>Configurações → Usuários do Sistema</strong>
          </li>
          <li>Criar usuário Admin</li>
          <li>
            Gerar token com: <strong>ads_read</strong>, <strong>ads_management</strong>,{" "}
            <strong>business_management</strong>
          </li>
        </ol>
      </div>
    </div>
  );
}
