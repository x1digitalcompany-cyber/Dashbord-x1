"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  X as XIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";

interface AdAccount {
  id: string;
  accountId: string;
  accountIdMasked: string;
  name: string | null;
  currency: string;
  isActive: boolean;
  tokenMasked: string;
  createdAt: string;
}

interface BusinessManager {
  bmId: string;
  bmName: string;
  accounts: AdAccount[];
  totalAccounts: number;
  activeAccounts: number;
}

interface DiscoverAccount {
  account_id: string;
  name: string | null;
  currency: string;
  error: string | null;
  already_registered: boolean;
}

interface HealthAccount {
  id: string;
  bm_id: string | null;
  account_id: string;
  name: string | null;
  status: "ok" | "error";
  error_message?: string | null;
}

interface OverviewBM {
  bmId: string;
  bmName: string;
  totalAccounts: number;
  activeAccounts: number;
  spend: number;
  verified: boolean;
  errors: string[];
}

type SubTab = "overview" | "configure";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

export function MetaAdsConfigPanel() {
  const { from, to } = useDashboardFilters();
  const [subTab, setSubTab] = useState<SubTab>("configure");
  const [bms, setBms] = useState<BusinessManager[]>([]);
  const [health, setHealth] = useState<HealthAccount[]>([]);
  const [overview, setOverview] = useState<{
    businessManagers: OverviewBM[];
    totalSpend: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    bm_name: "",
    bm_id: "",
    access_token: "",
    account_ids: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoverAccount[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Edit BM
  const [editingBm, setEditingBm] = useState<BusinessManager | null>(null);
  const [editForm, setEditForm] = useState({ bmName: "", accessToken: "", newAccountIds: "" });
  const [editAccountsToRemove, setEditAccountsToRemove] = useState<Set<string>>(new Set());
  const [editDiscovered, setEditDiscovered] = useState<DiscoverAccount[] | null>(null);
  const [editSelected, setEditSelected] = useState<Set<string>>(new Set());
  const [showEditToken, setShowEditToken] = useState(false);
  const [editDiscovering, setEditDiscovering] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Delete BM
  const [deletingBm, setDeletingBm] = useState<BusinessManager | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    // cache: "no-store" garante dados frescos do servidor após PATCH
    const res = await fetch("/api/dashboard/meta-ads/accounts", { cache: "no-store" });
    const json = await parseJsonResponse<{
      businessManagers: BusinessManager[];
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(json.error ?? "Falha ao carregar contas");
    setBms(json.businessManagers);
  }, []);

  const loadHealth = useCallback(async () => {
    const res = await fetch("/api/dashboard/meta-ads/health");
    const json = await parseJsonResponse<{ accounts: HealthAccount[] }>(res);
    if (res.ok) setHealth(json.accounts ?? []);
  }, []);

  const loadOverview = useCallback(async () => {
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    const res = await fetch(`/api/dashboard/meta-ads/overview?${params}`);
    const json = await parseJsonResponse<{
      businessManagers: OverviewBM[];
      totalSpend: number;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(json.error ?? "Falha ao carregar visão geral");
    setOverview({ businessManagers: json.businessManagers, totalSpend: json.totalSpend });
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadHealth()]);
      if (subTab === "overview") await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadHealth, loadOverview, subTab]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleExpand(bmId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(bmId)) next.delete(bmId);
      else next.add(bmId);
      return next;
    });
  }

  function healthForAccount(id: string) {
    return health.find((h) => h.id === id);
  }

  async function toggleAccount(id: string, isActive: boolean) {
    const res = await fetch(`/api/dashboard/meta-ads/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) return;
    await load();
  }

  async function refreshAccount(id: string) {
    setRefreshingId(id);
    try {
      await fetch(`/api/dashboard/meta-ads/accounts/${id}`);
      await loadHealth();
    } finally {
      setRefreshingId(null);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm("Remover esta conta de anúncio?")) return;
    await fetch(`/api/dashboard/meta-ads/accounts/${id}`, { method: "DELETE" });
    await load();
  }

  async function discoverAccounts() {
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/meta-ads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await parseJsonResponse<{ accounts: DiscoverAccount[]; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao descobrir contas");
      setDiscovered(json.accounts);
      setSelected(
        new Set(
          json.accounts.filter((a) => !a.error && !a.already_registered).map((a) => a.account_id)
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setDiscovering(false);
    }
  }

  async function saveAccounts() {
    if (!discovered) return;
    setSaving(true);
    try {
      const accounts = discovered
        .filter((a) => selected.has(a.account_id) && !a.error)
        .map((a) => ({
          account_id: a.account_id,
          name: a.name ?? `Conta ${a.account_id}`,
          currency: a.currency,
        }));
      const res = await fetch("/api/dashboard/meta-ads/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bm_id: form.bm_id,
          bm_name: form.bm_name,
          access_token: form.access_token,
          accounts,
        }),
      });
      const json = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setModalOpen(false);
      setDiscovered(null);
      setForm({ bm_name: "", bm_id: "", access_token: "", account_ids: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function openModal() {
    setDiscovered(null);
    setSelected(new Set());
    setForm({ bm_name: "", bm_id: "", access_token: "", account_ids: "" });
    setModalOpen(true);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function openEditBmModal(bm: BusinessManager) {
    setEditingBm(bm);
    setEditForm({ bmName: bm.bmName, accessToken: "", newAccountIds: "" });
    setEditAccountsToRemove(new Set());
    setEditDiscovered(null);
    setEditSelected(new Set());
    setShowEditToken(false);
    setError(null);
  }

  function closeEditBmModal() {
    setEditingBm(null);
    setEditDiscovered(null);
    setError(null);
  }

  async function handleEditDiscover() {
    if (!editingBm) return;
    if (!editForm.accessToken.trim()) {
      setError("Para verificar novas contas, informe o Access Token");
      return;
    }
    setEditDiscovering(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/meta-ads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bm_id: editingBm.bmId,
          access_token: editForm.accessToken.trim(),
          account_ids: editForm.newAccountIds,
        }),
      });
      const json = await parseJsonResponse<{ accounts: DiscoverAccount[]; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao verificar contas");
      setEditDiscovered(json.accounts);
      setEditSelected(
        new Set(
          json.accounts.filter((a) => !a.error && !a.already_registered).map((a) => a.account_id)
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao verificar contas");
    } finally {
      setEditDiscovering(false);
    }
  }

  async function handleEditSave() {
    if (!editingBm) return;
    setEditSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      const trimName = editForm.bmName.trim();
      if (trimName && trimName !== editingBm.bmName) body.name = trimName;
      if (editForm.accessToken.trim()) body.access_token = editForm.accessToken.trim();
      if (editAccountsToRemove.size > 0) body.accounts_to_remove = Array.from(editAccountsToRemove);
      if (editDiscovered && editSelected.size > 0) {
        body.accounts_to_add = editDiscovered
          .filter((a) => editSelected.has(a.account_id) && !a.error)
          .map((a) => a.account_id);
      }

      const res = await fetch(`/api/dashboard/meta-ads/bm/${editingBm.bmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      closeEditBmModal();
      // Chamar loadAccounts() diretamente em vez de load():
      // — load() engolia erros internamente sem relançar, fazendo o toast
      //   aparecer mesmo quando o refetch falhava e a lista ficava desatualizada.
      // — Aqui qualquer erro de rede/auth vai para o catch abaixo.
      await loadAccounts();
      showToast("BM atualizada com sucesso");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar BM");
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteBmModal(bm: BusinessManager) {
    setDeletingBm(bm);
    setError(null);
  }

  async function handleDeleteBm() {
    if (!deletingBm) return;
    setDeleteDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/meta-ads/bm/${deletingBm.bmId}`, { method: "DELETE" });
      const json = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Falha ao excluir BM");
      setBms((prev) => prev.filter((b) => b.bmId !== deletingBm.bmId));
      setDeletingBm(null);
      showToast("BM excluída com sucesso");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir BM");
    } finally {
      setDeleteDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
          {(
            [
              ["overview", "Visão Geral"],
              ["configure", "Configurar BMs"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                subTab === key
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === "configure" && (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            Adicionar BM
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando…
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {subTab === "overview" && overview && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-gray-800 dark:from-indigo-950 dark:to-gray-950">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Gasto total consolidado
            </p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(overview.totalSpend)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Período: {from.toISOString().slice(0, 10)} → {to.toISOString().slice(0, 10)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {overview.businessManagers.map((bm) => (
              <div
                key={bm.bmId}
                className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{bm.bmName}</h3>
                  {bm.verified ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {bm.activeAccounts}/{bm.totalAccounts} contas ativas
                </p>
                <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(bm.spend)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "configure" && !loading && (
        <div className="space-y-3">
          {bms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <Megaphone size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">Nenhuma Business Manager cadastrada.</p>
              <button
                type="button"
                onClick={openModal}
                className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
              >
                Adicionar primeira BM
              </button>
            </div>
          ) : (
            bms.map((bm) => {
              const isOpen = expanded.has(bm.bmId);
              const bmHealthOk = bm.accounts
                .filter((a) => a.isActive)
                .every((a) => healthForAccount(a.id)?.status === "ok");

              return (
                <div
                  key={bm.bmId}
                  className="rounded-xl border border-gray-100 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(bm.bmId)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {bm.bmName}
                        </h3>
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          {bm.activeAccounts > 0 ? "Ativa" : "Inativa"}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {bm.activeAccounts}/{bm.totalAccounts} contas
                        </span>
                        {bmHealthOk ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 size={12} /> Verificada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle size={12} /> Verificar token
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">BM ID: {bm.bmId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadHealth()}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      title="Re-verificar tokens"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditBmModal(bm)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-gray-800"
                      title="Editar BM"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteBmModal(bm)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-gray-800"
                      title="Excluir BM"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                      {bm.accounts.map((acc) => {
                        const h = healthForAccount(acc.id);
                        return (
                          <div
                            key={acc.id}
                            className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 dark:border-gray-900"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {acc.name ?? acc.accountIdMasked}
                              </p>
                              <p className="text-xs text-gray-400">
                                {acc.accountIdMasked} · {acc.currency}
                                {h?.status === "error" && (
                                  <span className="text-red-500"> — {h.error_message}</span>
                                )}
                              </p>
                            </div>
                            <Toggle
                              checked={acc.isActive}
                              onChange={(v) => toggleAccount(acc.id, v)}
                            />
                            <button
                              type="button"
                              onClick={() => refreshAccount(acc.id)}
                              disabled={refreshingId === acc.id}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-50"
                            >
                              {refreshingId === acc.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAccount(acc.id)}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Modal Editar BM ─────────────────────────────── */}
      <Modal
        open={!!editingBm}
        onClose={closeEditBmModal}
        title="Editar Business Manager"
        className="max-w-xl"
      >
        {editingBm && (
          <>
            {!editDiscovered ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome da BM
                  </label>
                  <input
                    value={editForm.bmName}
                    onChange={(e) => setEditForm((f) => ({ ...f, bmName: e.target.value }))}
                    placeholder="Nome da BM"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Access Token{" "}
                    <span className="font-normal text-gray-400">(deixe em branco para manter o atual)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showEditToken ? "text" : "password"}
                      value={editForm.accessToken}
                      onChange={(e) => setEditForm((f) => ({ ...f, accessToken: e.target.value }))}
                      placeholder="Novo token (opcional)"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm dark:border-gray-700 dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditToken((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showEditToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contas de anúncio atuais
                  </label>
                  {editingBm.accounts.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma conta cadastrada.</p>
                  ) : (
                    <div className="divide-y divide-gray-50 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                      {editingBm.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5",
                            editAccountsToRemove.has(acc.id) && "opacity-50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "text-sm font-medium text-gray-800 dark:text-gray-200",
                              editAccountsToRemove.has(acc.id) && "line-through"
                            )}>
                              {acc.name ?? acc.accountIdMasked}
                            </p>
                            <p className="text-xs text-gray-400">
                              {acc.accountIdMasked} · {acc.currency}
                            </p>
                          </div>
                          <button
                            type="button"
                            title={editAccountsToRemove.has(acc.id) ? "Desfazer remoção" : "Remover conta"}
                            onClick={() =>
                              setEditAccountsToRemove((prev) => {
                                const next = new Set(prev);
                                if (next.has(acc.id)) next.delete(acc.id);
                                else next.add(acc.id);
                                return next;
                              })
                            }
                            className={cn(
                              "rounded p-1 transition-colors",
                              editAccountsToRemove.has(acc.id)
                                ? "text-amber-500 hover:text-gray-400"
                                : "text-gray-300 hover:text-red-500"
                            )}
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Adicionar mais contas
                  </label>
                  <textarea
                    value={editForm.newAccountIds}
                    onChange={(e) => setEditForm((f) => ({ ...f, newAccountIds: e.target.value }))}
                    placeholder="act_123456789, act_987654321"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  {editForm.newAccountIds.trim() && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditDiscover}
                        disabled={editDiscovering}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {editDiscovering && <Loader2 size={12} className="animate-spin" />}
                        {editDiscovering ? "Verificando…" : "Verificar contas →"}
                      </button>
                      {!editForm.accessToken.trim() && (
                        <p className="mt-1 text-xs text-amber-600">
                          Informe o Access Token para verificar novas contas
                        </p>
                      )}
                    </>
                  )}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex items-center justify-between gap-2 pt-1">
                  {editAccountsToRemove.size > 0 ? (
                    <p className="text-xs text-red-500">{editAccountsToRemove.size} conta(s) marcada(s) para remover</p>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeEditBmModal}
                      className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {editSaving && <Loader2 size={14} className="animate-spin" />}
                      Salvar alterações
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: resultados da descoberta de novas contas */
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Selecione as contas para adicionar a esta BM:
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-400">
                      <th className="pb-2 pr-2">Sel.</th>
                      <th className="pb-2">Conta</th>
                      <th className="pb-2">Moeda</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editDiscovered.map((a) => (
                      <tr key={a.account_id} className="border-b border-gray-50 dark:border-gray-900">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={editSelected.has(a.account_id)}
                            disabled={!!a.error || a.already_registered}
                            onChange={(e) =>
                              setEditSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(a.account_id);
                                else next.delete(a.account_id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="py-2">
                          <p className="font-medium">{a.name ?? a.account_id}</p>
                          <p className="text-xs text-gray-400">act_{a.account_id}</p>
                        </td>
                        <td className="py-2">{a.currency}</td>
                        <td className="py-2 text-xs">
                          {a.error ? (
                            <span className="text-red-500">{a.error}</span>
                          ) : a.already_registered ? (
                            <span className="text-amber-600">Já cadastrada</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDiscovered(null)}
                    className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {editSaving && <Loader2 size={14} className="animate-spin" />}
                    Salvar alterações
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal Excluir BM ────────────────────────────── */}
      <Modal
        open={!!deletingBm}
        onClose={() => setDeletingBm(null)}
        title="Excluir Business Manager"
        className="max-w-md"
      >
        {deletingBm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir a BM{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                &ldquo;{deletingBm.bmName}&rdquo;
              </span>
              ? Isso vai remover{" "}
              <span className="font-semibold">{deletingBm.totalAccounts} conta(s)</span> de anúncio
              vinculada(s) e parar a sincronização de dados dela. Os dados históricos de gasto já
              registrados não serão apagados.
            </p>

            {bms.filter((b) => b.activeAccounts > 0).length === 1 &&
              deletingBm.activeAccounts > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Esta é a única BM ativa. A sincronização de anúncios vai parar após a exclusão.
                </div>
              )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBm(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteBm}
                disabled={deleteDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteDeleting && <Loader2 size={14} className="animate-spin" />}
                Excluir BM
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Toast ───────────────────────────────────────── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-gray-100 dark:text-gray-900">
          {toastMsg}
        </div>
      )}

      {/* ── Modal Adicionar BM ──────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Adicionar Business Manager"
        className="max-w-xl"
      >
        <p className="mb-4 text-sm text-gray-500">
          Configure uma nova BM com seu token de acesso e contas de anúncio.
        </p>

        {!discovered ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome da BM</label>
              <input
                value={form.bm_name}
                onChange={(e) => setForm((f) => ({ ...f, bm_name: e.target.value }))}
                placeholder="BM Cliente X"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">BM ID</label>
              <input
                value={form.bm_id}
                onChange={(e) => setForm((f) => ({ ...f, bm_id: e.target.value }))}
                placeholder="123456789"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={form.access_token}
                  onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ad Account IDs
              </label>
              <textarea
                value={form.account_ids}
                onChange={(e) => setForm((f) => ({ ...f, account_ids: e.target.value }))}
                placeholder="act_123456789, act_987654321"
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={discoverAccounts}
                disabled={discovering || !form.bm_id || !form.access_token || !form.account_ids}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {discovering && <Loader2 size={14} className="animate-spin" />}
                Descobrir contas →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-400">
                  <th className="pb-2 pr-2">Sel.</th>
                  <th className="pb-2">Conta</th>
                  <th className="pb-2">Moeda</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {discovered.map((a) => (
                  <tr key={a.account_id} className="border-b border-gray-50 dark:border-gray-900">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(a.account_id)}
                        disabled={!!a.error || a.already_registered}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(a.account_id);
                            else next.delete(a.account_id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <p className="font-medium">{a.name ?? a.account_id}</p>
                      <p className="text-xs text-gray-400">act_{a.account_id}</p>
                    </td>
                    <td className="py-2">{a.currency}</td>
                    <td className="py-2 text-xs">
                      {a.error ? (
                        <span className="text-red-500">{a.error}</span>
                      ) : a.already_registered ? (
                        <span className="text-amber-600">Já cadastrada</span>
                      ) : (
                        <span className="text-emerald-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscovered(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={saveAccounts}
                disabled={saving || selected.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Adicionar ({selected.size})
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
