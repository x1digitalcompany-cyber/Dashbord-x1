"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Trophy,
  AlertTriangle,
  Users,
  ChevronRight,
  X,
  Plus,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Percent,
  Calendar,
  Pencil,
  Check,
  PackageCheck,
  PackageX,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SellerStat {
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  is_active: boolean;
  modelo_salario: "fixo_mais_comissao" | "so_comissao";
  meta_mensal: number;
  pedidos: number;
  entregues: number;
  pagos: number;
  inadimplentes: number;
  devolvidos: number;
  faturamento: number;
  ticket_medio: number;
  taxa_inadimplencia: number;
  meta_pct: number;
}

interface OrderRow {
  order_number: string;
  display_id: string | null;
  customer_name: string;
  kanban_status: string;
  value: number | string | null;
  payment_type: string;
  created_at: string;
  tracking_code: string | null;
  city: string | null;
  state: string | null;
}

// ── Period helpers ────────────────────────────────────────────────────────────

type PeriodLabel = "Hoje" | "Ontem" | "7 dias" | "Este mês" | "Mês passado" | "Personalizado";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function monthBounds(base: string): { start: string; end: string } {
  const [y, m] = base.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

function prevMonthBounds(base: string): { start: string; end: string } {
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return monthBounds(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
}

function presets(ref: string) {
  const ontem = addDays(ref, -1);
  const ha7 = addDays(ref, -6);
  const mes = monthBounds(ref);
  const prev = prevMonthBounds(ref);
  return [
    { label: "Hoje" as PeriodLabel, from: ref, to: ref },
    { label: "Ontem" as PeriodLabel, from: ontem, to: ontem },
    { label: "7 dias" as PeriodLabel, from: ha7, to: ref },
    { label: "Este mês" as PeriodLabel, from: mes.start, to: mes.end },
    { label: "Mês passado" as PeriodLabel, from: prev.start, to: prev.end },
  ];
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(value: number): string {
  return value.toFixed(1) + "%";
}

function calcSalario(faturamento: number, modelo: string) {
  if (modelo === "fixo_mais_comissao") {
    const comissao = faturamento * 0.05;
    return { fixo: 1600, comissao, total: 1600 + comissao, pct: 5 };
  }
  const comissao = faturamento * 0.1;
  return { fixo: 0, comissao, total: comissao, pct: 10 };
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-green-500", "bg-pink-500",
  "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function iniciais(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const KANBAN_LABEL: Record<string, string> = {
  pedidos_criados: "Criado",
  em_transito: "Em trânsito",
  retirar_correios: "Retirar Correios",
  requer_atencao: "Requer Atenção",
  entregue: "Entregue",
  pagos: "Pago",
  devolvidos: "Devolvido",
  inadimplentes: "Inadimplente",
};

const KANBAN_STYLE: Record<string, string> = {
  pagos: "bg-green-100 text-green-700",
  entregue: "bg-emerald-100 text-emerald-700",
  inadimplentes: "bg-red-100 text-red-700",
  devolvidos: "bg-gray-100 text-gray-600",
  requer_atencao: "bg-orange-100 text-orange-700",
  em_transito: "bg-blue-100 text-blue-700",
  retirar_correios: "bg-yellow-100 text-yellow-700",
  pedidos_criados: "bg-indigo-100 text-indigo-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function VendedoresPageClient() {
  const refToday = today();
  const refPresets = presets(refToday);

  // Period state
  const [activeLabel, setActiveLabel] = useState<PeriodLabel>("Este mês");
  const [from, setFrom] = useState(() => monthBounds(refToday).start);
  const [to, setTo] = useState(() => monthBounds(refToday).end);
  const [customFrom, setCustomFrom] = useState(refToday);
  const [customTo, setCustomTo] = useState(refToday);

  // Data state
  const [sellers, setSellers] = useState<SellerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [drawer, setDrawer] = useState<SellerStat | null>(null);
  const [drawerOrders, setDrawerOrders] = useState<OrderRow[]>([]);
  const [drawerOrdersLoading, setDrawerOrdersLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    email: "", phone: "", cpf: "", modelo_salario: "so_comissao", meta_mensal: "0",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // New seller modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "", email: "", phone: "", modelo_salario: "so_comissao", meta_mensal: "",
  });
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // Load ranking
  const loadSellers = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/vendedores?from=${f}&to=${t}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar");
      setSellers(json.sellers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSellers(from, to);
  }, [from, to, loadSellers]);

  function selectPeriod(label: PeriodLabel, f: string, t: string) {
    setActiveLabel(label);
    setFrom(f);
    setTo(t);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    selectPeriod("Personalizado", customFrom, customTo);
  }

  // Open drawer
  async function openDrawer(seller: SellerStat) {
    setDrawer(seller);
    setEditMode(false);
    setEditError(null);
    setEditForm({
      email: seller.email ?? "",
      phone: seller.phone ?? "",
      cpf: seller.cpf ?? "",
      modelo_salario: seller.modelo_salario,
      meta_mensal: String(seller.meta_mensal),
    });
    setDrawerOrders([]);
    setDrawerOrdersLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/vendedores/${encodeURIComponent(seller.name)}?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setDrawerOrders(json.orders ?? []);
    } catch {
      setDrawerOrders([]);
    } finally {
      setDrawerOrdersLoading(false);
    }
  }

  // Save edit
  async function handleEditSave() {
    if (!drawer) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/dashboard/vendedores/${encodeURIComponent(drawer.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: editForm.email || null,
            phone: editForm.phone || null,
            cpf: editForm.cpf || null,
            modelo_salario: editForm.modelo_salario,
            meta_mensal: Number(editForm.meta_mensal) || 0,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setEditMode(false);
      showToast("Vendedor atualizado");
      await loadSellers(from, to);
      // Update drawer with new data
      const updated = sellers.find((s) => s.name === drawer.name);
      if (updated) {
        setDrawer({
          ...updated,
          email: editForm.email || null,
          phone: editForm.phone || null,
          cpf: editForm.cpf || null,
          modelo_salario: editForm.modelo_salario as "fixo_mais_comissao" | "so_comissao",
          meta_mensal: Number(editForm.meta_mensal) || 0,
        });
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setEditSaving(false);
    }
  }

  // Toggle ativo/inativo
  async function handleToggleAtivo() {
    if (!drawer) return;
    const newVal = !drawer.is_active;
    try {
      const res = await fetch(
        `/api/dashboard/vendedores/${encodeURIComponent(drawer.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: newVal }),
        }
      );
      if (!res.ok) return;
      setDrawer({ ...drawer, is_active: newVal });
      showToast(newVal ? "Vendedor ativado" : "Vendedor desativado");
      await loadSellers(from, to);
    } catch { /* ignore */ }
  }

  // Create new seller
  async function handleNewSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    setNewSaving(true);
    setNewError(null);
    try {
      const res = await fetch("/api/dashboard/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name.trim(),
          email: newForm.email || null,
          phone: newForm.phone || null,
          modelo_salario: newForm.modelo_salario,
          meta_mensal: Number(newForm.meta_mensal) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao criar");
      setShowNew(false);
      setNewForm({ name: "", email: "", phone: "", modelo_salario: "so_comissao", meta_mensal: "" });
      showToast("Vendedor criado");
      await loadSellers(from, to);
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setNewSaving(false);
    }
  }

  // Derived metrics
  const ativos = sellers.filter((s) => s.is_active);
  const melhor = sellers.length > 0 ? sellers[0] : null;
  const maiorInad =
    sellers.length > 0
      ? [...sellers].sort((a, b) => b.taxa_inadimplencia - a.taxa_inadimplencia)[0]
      : null;

  // Drawer salary
  const drawerSalary = drawer ? calcSalario(drawer.faturamento, drawer.modelo_salario) : null;
  const drawerMeta = drawer?.meta_mensal ?? 0;
  const drawerMetaPct = drawerMeta > 0 && drawer ? Math.min((drawer.faturamento / drawerMeta) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Ranking e performance da equipe — dados da Five
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setNewError(null); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={15} />
          Novo Vendedor
        </button>
      </div>

      {/* ── Period Selector ──────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {refPresets.map((p) => (
            <button
              key={p.label}
              onClick={() => selectPeriod(p.label, p.from, p.to)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeLabel === p.label
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            <span className="text-gray-400 text-sm">até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Calendar size={12} />
          {activeLabel} · {from} a {to}
          {loading && <span className="ml-2 text-indigo-500 animate-pulse">Carregando...</span>}
        </p>
      </div>

      {/* ── Cards de destaque ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Trophy size={16} className="text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Melhor do período
            </p>
          </div>
          {melhor && melhor.faturamento > 0 ? (
            <>
              <p className="text-lg font-bold text-amber-600 leading-tight truncate">{melhor.name}</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{fmt(melhor.faturamento)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{melhor.pagos} pedidos pagos</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sem dados</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Maior inadimplência
            </p>
          </div>
          {maiorInad && maiorInad.taxa_inadimplencia > 0 ? (
            <>
              <p className="text-lg font-bold text-red-500 leading-tight truncate">{maiorInad.name}</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                {fmtPct(maiorInad.taxa_inadimplencia)} de taxa
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{maiorInad.inadimplentes} inadimplentes</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sem inadimplência</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Users size={16} className="text-purple-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Equipe ativa
            </p>
          </div>
          <p className="text-3xl font-bold text-purple-600">{ativos.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {sellers.length} no total
          </p>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* ── Ranking Table ────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Ranking do período
        </h2>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {sellers.length === 0 && !loading ? (
            <div className="p-10 text-center text-gray-400 dark:text-gray-500">
              Nenhum vendedor encontrado para o período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    {["#", "Vendedor", "Pedidos", "Entregues", "Pagos", "Inadim.", "Taxa Inad.", "Faturamento", "Ticket Médio", "Meta %", ""].map(
                      (h) => (
                        <th key={h} className="text-left px-3 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {sellers.map((s, i) => (
                    <tr
                      key={s.name}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => openDrawer(s)}
                    >
                      <td className="px-3 py-3 text-gray-400 font-bold text-xs w-8">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 ${avatarColor(s.name)} rounded-lg flex items-center justify-center shrink-0`}>
                            <span className="text-white text-xs font-bold">{iniciais(s.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-white truncate block">{s.name}</span>
                            {!s.is_active && (
                              <span className="text-[10px] text-gray-400">Inativo</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-300">{s.pedidos}</td>
                      <td className="px-3 py-3 text-emerald-600 font-semibold">{s.entregues}</td>
                      <td className="px-3 py-3 text-green-600 font-semibold">{s.pagos}</td>
                      <td className="px-3 py-3 text-red-500 font-semibold">{s.inadimplentes}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          s.taxa_inadimplencia > 20 ? "bg-red-100 text-red-600" :
                          s.taxa_inadimplencia > 10 ? "bg-orange-100 text-orange-600" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {fmtPct(s.taxa_inadimplencia)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-indigo-600 whitespace-nowrap">{fmt(s.faturamento)}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(s.ticket_medio)}</td>
                      <td className="px-3 py-3 w-32">
                        {s.meta_mensal > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${s.meta_pct >= 100 ? "bg-green-500" : "bg-indigo-600"}`}
                                style={{ width: `${s.meta_pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{s.meta_pct.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight size={15} className="text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Drawer ──────────────────────────────────────────── */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawer(null)}
          />
          <div className="relative ml-auto w-full max-w-xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
              <div className={`w-12 h-12 ${avatarColor(drawer.name)} rounded-2xl flex items-center justify-center shrink-0`}>
                <span className="text-white text-base font-bold">{iniciais(drawer.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{drawer.name}</h2>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    drawer.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {drawer.is_active ? "Ativo" : "Inativo"}
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {drawer.modelo_salario === "fixo_mais_comissao" ? "Modelo A" : "Modelo B"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditMode(!editMode); setEditError(null); }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDrawer(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* Edit form */}
              {editMode && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 space-y-3 border border-indigo-200 dark:border-indigo-800">
                  <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Editar dados</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">E-mail</label>
                      <input
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Telefone</label>
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Meta mensal (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.meta_mensal}
                        onChange={(e) => setEditForm({ ...editForm, meta_mensal: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Modelo salário</label>
                      <select
                        value={editForm.modelo_salario}
                        onChange={(e) => setEditForm({ ...editForm, modelo_salario: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="so_comissao">Modelo B — 10% comissão</option>
                        <option value="fixo_mais_comissao">Modelo A — R$1.600 + 5%</option>
                      </select>
                    </div>
                  </div>
                  {editError && (
                    <p className="text-xs text-red-500">{editError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleToggleAtivo()}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        drawer.is_active
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {drawer.is_active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Check size={13} />
                      {editSaving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShoppingCart size={13} className="text-gray-400" />
                    <p className="text-xs text-gray-500">Pedidos</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{drawer.pedidos}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">no período</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={13} className="text-green-500" />
                    <p className="text-xs text-gray-500">Faturamento</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">{fmt(drawer.faturamento)}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{drawer.pagos} pagos</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PackageCheck size={13} className="text-emerald-500" />
                    <p className="text-xs text-gray-500">Entregues</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{drawer.entregues}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PackageX size={13} className="text-red-400" />
                    <p className="text-xs text-gray-500">Inadimplentes</p>
                  </div>
                  <p className="text-xl font-bold text-red-500">{drawer.inadimplentes}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{fmtPct(drawer.taxa_inadimplencia)} taxa</p>
                </div>
              </div>

              {/* Salary card */}
              {drawerSalary && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-indigo-600" />
                    <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      Salário estimado — {drawer.modelo_salario === "fixo_mais_comissao" ? "Modelo A (R$1.600 + 5%)" : "Modelo B (10%)"}
                    </h3>
                  </div>
                  <div className={`grid gap-3 ${drawer.modelo_salario === "fixo_mais_comissao" ? "grid-cols-3" : "grid-cols-2"}`}>
                    {drawer.modelo_salario === "fixo_mais_comissao" && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-[11px] text-gray-500 mb-1">Fixo</p>
                        <p className="font-bold text-gray-800 dark:text-white">{fmt(drawerSalary.fixo)}</p>
                      </div>
                    )}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-[11px] text-gray-500 mb-1">Comissão ({drawerSalary.pct}%)</p>
                      <p className="font-bold text-indigo-600">{fmt(drawerSalary.comissao)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-[11px] text-gray-500 mb-1">Total</p>
                      <p className="font-bold text-green-600">{fmt(drawerSalary.total)}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  {drawerMeta > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          Meta: {fmt(drawerMeta)}
                        </span>
                        <span className={`font-semibold ${drawerMetaPct >= 100 ? "text-green-600" : "text-indigo-600"}`}>
                          {drawerMetaPct.toFixed(0)}%
                          {drawerMetaPct >= 100 && " ✓"}
                        </span>
                      </div>
                      <div className="w-full bg-white dark:bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${drawerMetaPct >= 100 ? "bg-green-500" : "bg-indigo-600"}`}
                          style={{ width: `${drawerMetaPct}%` }}
                        />
                      </div>
                      {drawerMeta > drawer.faturamento && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Falta {fmt(drawerMeta - drawer.faturamento)} para bater a meta
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Contact info */}
              {(drawer.email || drawer.phone || drawer.cpf) && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                  {drawer.email && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-500">Email:</span> {drawer.email}
                    </p>
                  )}
                  {drawer.phone && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-500">Tel:</span> {drawer.phone}
                    </p>
                  )}
                  {drawer.cpf && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-500">CPF:</span> {drawer.cpf}
                    </p>
                  )}
                </div>
              )}

              {/* Orders list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Pedidos no período{" "}
                  <span className="text-gray-400 font-normal">({drawerOrders.length})</span>
                </h3>
                {drawerOrdersLoading ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center text-xs text-gray-400 animate-pulse">
                    Carregando pedidos...
                  </div>
                ) : drawerOrders.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center text-xs text-gray-400">
                    Nenhum pedido no período.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                          {["ID", "Cliente", "Status", "Valor", "Tipo", "Data"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {drawerOrders.map((o) => (
                          <tr key={o.order_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                              {o.display_id ?? o.order_number.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[120px] truncate">
                              {o.customer_name}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${KANBAN_STYLE[o.kanban_status] ?? "bg-gray-100 text-gray-500"}`}>
                                {KANBAN_LABEL[o.kanban_status] ?? o.kanban_status}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-indigo-600 whitespace-nowrap">
                              {fmt(Number(o.value) || 0)}
                            </td>
                            <td className="px-3 py-2 text-gray-500 capitalize whitespace-nowrap">
                              {o.payment_type === "agendado" || o.payment_type === "payafter" ? "Agendado" : "Antecipado"}
                            </td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                              {new Date(o.created_at).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Novo Vendedor Modal ──────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <form
            onSubmit={handleNewSave}
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Novo Vendedor</h2>
              <button type="button" onClick={() => setShowNew(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Nome *</label>
                <input
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  required
                  placeholder="Nome do vendedor (deve coincidir com o campo 'autor' da Five)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Deve ser idêntico ao campo "autor" enviado pelo webhook da Five.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Telefone</label>
                  <input
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Meta mensal (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newForm.meta_mensal}
                    onChange={(e) => setNewForm({ ...newForm, meta_mensal: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Modelo salário</label>
                  <select
                    value={newForm.modelo_salario}
                    onChange={(e) => setNewForm({ ...newForm, modelo_salario: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="so_comissao">Modelo B — 10%</option>
                    <option value="fixo_mais_comissao">Modelo A — R$1.600 + 5%</option>
                  </select>
                </div>
              </div>
            </div>

            {newError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{newError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={newSaving || !newForm.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus size={14} />
                {newSaving ? "Criando..." : "Criar Vendedor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Check size={14} className="text-green-400 dark:text-green-600" />
          {toast}
        </div>
      )}
    </div>
  );
}
