"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  PackagePlus,
  PackageCheck,
  Truck,
  MapPin,
  CheckCircle2,
  CircleDollarSign,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Search,
  X,
  ExternalLink,
  CreditCard,
  QrCode,
  FileText,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  applyKanbanSearch,
  isKanbanColumn,
  validColumnsForTipo,
  KANBAN_COLUMNS,
} from "@/lib/kanban-utils";
import { cn, formatCurrency, formatDatetime, timeAgo } from "@/lib/utils";
import type {
  KanbanColumn,
  KanbanColumns,
  KanbanOperationType,
  KanbanOrder,
} from "@/types";

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  id: KanbanColumn;
  label: string;
  shortLabel: string;
  headerBg: string;
  dotColor: string;
  Icon: React.ElementType;
}

const ALL_COLUMN_DEFS: Record<KanbanColumn, ColumnDef> = {
  pedidos_criados:  { id: "pedidos_criados",  label: "Pedidos Criados",  shortLabel: "Criados",    headerBg: "bg-blue-50",   dotColor: "bg-[#3B8BD4]", Icon: PackagePlus },
  em_transito:      { id: "em_transito",      label: "Em Trânsito",      shortLabel: "Trânsito",   headerBg: "bg-violet-50", dotColor: "bg-[#7C3AED]", Icon: Truck },
  retirar_correios: { id: "retirar_correios", label: "Retirar Correios", shortLabel: "Correios",   headerBg: "bg-amber-50",  dotColor: "bg-[#EF9F27]", Icon: MapPin },
  requer_atencao:   { id: "requer_atencao",   label: "Requer Atenção",   shortLabel: "Atenção",    headerBg: "bg-orange-50", dotColor: "bg-[#EA580C]", Icon: AlertTriangle },
  entregue:         { id: "entregue",         label: "Entregue",         shortLabel: "Entregue",   headerBg: "bg-green-50",  dotColor: "bg-[#639922]", Icon: PackageCheck },
  pagos:            { id: "pagos",            label: "Pagos",            shortLabel: "Pagos",      headerBg: "bg-emerald-50",dotColor: "bg-[#16A34A]", Icon: CircleDollarSign },
  devolvidos:       { id: "devolvidos",       label: "Devolvidos",       shortLabel: "Devolvidos", headerBg: "bg-red-50",    dotColor: "bg-[#A32D2D]", Icon: RotateCcw },
  inadimplentes:    { id: "inadimplentes",    label: "Inadimplentes",    shortLabel: "Inadimp.",   headerBg: "bg-rose-50",   dotColor: "bg-[#993556]", Icon: AlertCircle },
};

const ANTECIPADO_COLS: KanbanColumn[] = [
  "pedidos_criados", "em_transito", "retirar_correios", "requer_atencao", "devolvidos", "entregue",
];
const AGENDADO_COLS: KanbanColumn[] = [
  "pedidos_criados", "em_transito", "retirar_correios", "requer_atencao", "entregue", "pagos", "devolvidos", "inadimplentes",
];

const STATUS_BADGE_VARIANT: Record<KanbanColumn, "blue" | "violet" | "amber" | "orange" | "green" | "emerald" | "red" | "rose"> = {
  pedidos_criados:  "blue",
  em_transito:      "violet",
  retirar_correios: "amber",
  requer_atencao:   "orange",
  entregue:         "green",
  pagos:            "emerald",
  devolvidos:       "red",
  inadimplentes:    "rose",
};

const PAYMENT_ICON: Record<string, React.ElementType> = {
  PIX:    QrCode,
  CARD:   CreditCard,
  BOLETO: FileText,
};

// ─── KanbanCard ───────────────────────────────────────────────────────────────

function KanbanCard({
  order,
  columnId,
  onClick,
  isDragging,
}: {
  order: KanbanOrder;
  columnId: KanbanColumn;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
    data: { type: "order", columnId },
  });
  const shortId = order.displayId ?? order.orderNumber.slice(-8).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md",
        "px-3 py-2.5",
        isDragging && "opacity-40"
      )}
    >
      {/* Linha 1: #ID · Valor */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] font-bold text-indigo-600 truncate">#{shortId}</span>
        <span className="text-[11px] font-bold text-gray-900 tabular-nums shrink-0">
          {formatCurrency(order.value)}
        </span>
      </div>

      {/* Linha 2: Nome */}
      <p className="text-[13px] font-medium text-gray-900 truncate mb-1">
        {order.customerName}
      </p>

      {/* Linha 3: Rastreio */}
      {order.trackingCode && (
        <div className="flex items-center gap-1 mb-1 text-[11px] text-gray-400">
          <Truck size={10} className="shrink-0" />
          <span className="font-mono truncate">{order.trackingCode}</span>
        </div>
      )}

      {/* Linha 4: Tempo · Ver detalhes */}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-50">
        <span className="text-[11px] text-gray-400">
          {timeAgo(order.updatedAt ?? order.createdAt)}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
        >
          Ver detalhes →
        </button>
      </div>
    </div>
  );
}

// ─── KanbanColumnComponent ────────────────────────────────────────────────────

function KanbanColumnComponent({
  column,
  orders,
  onCardClick,
  activeId,
}: {
  column: ColumnDef;
  orders: KanbanOrder[];
  onCardClick: (order: KanbanOrder) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Header fixo (não scrolla) */}
      <div className={cn("flex-none flex items-center gap-1 px-2 py-2 rounded-xl mb-1.5", column.headerBg)}>
        <span className={cn("w-2 h-2 rounded-full shrink-0", column.dotColor)} />
        <column.Icon size={11} className="text-gray-600 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-700 flex-1 min-w-0 leading-tight truncate">
          {column.shortLabel}
        </span>
        <span className="text-[10px] font-bold text-gray-500 bg-white/70 rounded-full px-1.5 py-0.5 shrink-0">
          {orders.length}
        </span>
      </div>

      {/* Área de cards com scroll vertical interno */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden space-y-1.5 rounded-xl p-1 pb-2 transition-colors",
          isOver && "bg-indigo-50/60 ring-2 ring-indigo-200 ring-inset"
        )}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}
      >
        {orders.length === 0 && (
          <div className="flex items-center justify-center h-16 text-[11px] text-gray-300 select-none">
            Vazio
          </div>
        )}
        {orders.map((order) => (
          <KanbanCard
            key={order.id}
            order={order}
            columnId={column.id}
            onClick={() => onCardClick(order)}
            isDragging={activeId === order.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
}: {
  order: KanbanOrder | null;
  onClose: () => void;
}) {
  if (!order) return null;
  const PayIcon = PAYMENT_ICON[order.paymentMethod] ?? CreditCard;
  const displayId = order.displayId ?? order.orderNumber.slice(-8).toUpperCase();
  const colDef = ALL_COLUMN_DEFS[order.status];

  return (
    <Modal open={!!order} onClose={onClose} title={`#${displayId}`}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
            {colDef?.label ?? order.status}
          </Badge>
          <span className="text-xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(order.value)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente">
            <span className="font-medium text-gray-900">{order.customerName}</span>
          </Field>
          <Field label="Documento (CPF/CNPJ)">
            <span className="font-mono">{order.customerDoc || order.customerCpf || "—"}</span>
          </Field>
          <Field label="E-mail">
            <span className="truncate block">{order.customerEmail || "—"}</span>
          </Field>
          <Field label="Telefone">{order.customerPhone || "—"}</Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Produto">
            <span className="font-medium text-gray-900">{order.productName}</span>
          </Field>
          {order.offerTitle && <Field label="Oferta">{order.offerTitle}</Field>}
          {order.projectName && <Field label="Projeto">{order.projectName}</Field>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendedor">{order.sellerName ?? "—"}</Field>
          <Field label="Pagamento">
            <div className="flex items-center gap-1.5">
              <PayIcon size={13} className="text-gray-500" />
              <span>{order.paymentMethod}</span>
            </div>
          </Field>
          <Field label="Data do pedido">{formatDatetime(order.createdAt)}</Field>
          {order.paidAt && <Field label="Pago em">{formatDatetime(order.paidAt)}</Field>}
        </div>

        {order.trackingCode && (
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <p className="text-xs text-gray-400 mb-1">
              Rastreamento{order.shippingPlatform ? ` — ${order.shippingPlatform}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-gray-800 flex-1">{order.trackingCode}</code>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}

        {(order.addressFull || order.address) && (
          <div className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} className="text-gray-400" />
              <p className="text-xs text-gray-400">Endereço de entrega</p>
            </div>
            {order.addressFull && !order.address && (
              <p className="text-gray-700">{order.addressFull}</p>
            )}
            {order.address && (
              <>
                <p className="text-gray-700">
                  {order.address.street}
                  {order.address.number ? `, ${order.address.number}` : ""}
                  {order.address.complement ? ` — ${order.address.complement}` : ""}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {order.address.neighborhood && `${order.address.neighborhood}, `}
                  {order.address.city}/{order.address.state}
                  {order.address.zipCode ? ` — CEP ${order.address.zipCode}` : ""}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KanbanFiveProps {
  tipo: KanbanOperationType;
  data: KanbanColumns | null;
  loading?: boolean;
  error?: string;
  title?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onMove?: (orderId: string, newColumn: KanbanColumn) => Promise<void>;
}

export function KanbanFive({
  tipo,
  data,
  loading,
  error,
  title = "Kanban Five",
  search,
  onSearchChange,
  onMove,
}: KanbanFiveProps) {
  const [columns, setColumns] = useState<KanbanColumns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<KanbanOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<KanbanOrder | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Sync external data without interfering with active drag
  useEffect(() => {
    if (data !== null && !activeId) setColumns(data);
  }, [data, activeId]);

  const activeCols = tipo === "antecipado" ? ANTECIPADO_COLS : AGENDADO_COLS;
  const validForTipo = validColumnsForTipo(tipo);

  const displayColumns = useMemo(
    () => (columns ? applyKanbanSearch(columns, search) : null),
    [columns, search]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const findOrder = useCallback(
    (id: string): { order: KanbanOrder; col: KanbanColumn } | null => {
      if (!columns) return null;
      for (const col of KANBAN_COLUMNS) {
        const order = (columns[col] ?? []).find((o) => o.id === id);
        if (order) return { order, col };
      }
      return null;
    },
    [columns]
  );

  const resolveTargetColumn = useCallback(
    (over: DragOverEvent["over"] | DragEndEvent["over"]): KanbanColumn | null => {
      if (!over) return null;
      const dataCol = over.data.current?.columnId;
      if (typeof dataCol === "string" && isKanbanColumn(dataCol)) return dataCol;
      if (isKanbanColumn(String(over.id))) return over.id as KanbanColumn;
      return findOrder(String(over.id))?.col ?? null;
    },
    [findOrder]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setMoveError(null);
    const found = findOrder(event.active.id as string);
    if (found) setActiveOrder(found.order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveOrder(null);
    if (!over || !columns) return;

    const found = findOrder(active.id as string);
    if (!found) return;

    const targetCol = resolveTargetColumn(over);
    if (!targetCol || found.col === targetCol) return;

    // Rejeita drop em coluna inválida para a aba atual
    if (!validForTipo.includes(targetCol)) return;

    const prevColumns = columns;
    const next = { ...columns };
    next[found.col] = next[found.col].filter((o) => o.id !== active.id);
    next[targetCol] = [{ ...found.order, status: targetCol }, ...next[targetCol]];
    setColumns(next);

    onMove?.(active.id as string, targetCol)?.catch(() => {
      setColumns(prevColumns);
      setMoveError("Falha ao mover pedido — alteração revertida");
      setTimeout(() => setMoveError(null), 4000);
    });
  };

  const colCount = activeCols.length;
  const gridClass = colCount === 6 ? "grid-cols-6" : "grid-cols-8";

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className={cn("grid gap-2", gridClass)}>
          {activeCols.map((id) => (
            <div key={id} className="space-y-2">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const currentColumns = displayColumns ?? ({} as KanbanColumns);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </h3>
          <div className="flex items-center gap-3">
            {moveError && (
              <span className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                {moveError}
              </span>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar #código, cliente ou rastreio…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid fixo — sem overflow-x */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={cn("grid gap-2 w-full overflow-x-hidden", gridClass)}>
            {activeCols.map((colId) => (
              <KanbanColumnComponent
                key={colId}
                column={ALL_COLUMN_DEFS[colId]}
                orders={currentColumns[colId] ?? []}
                onCardClick={setSelectedOrder}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeOrder && (
              <div className="bg-white rounded-xl border border-indigo-200 shadow-xl px-3 py-2.5 rotate-2 opacity-95 w-[180px]">
                <p className="text-[11px] font-bold text-indigo-600">
                  #{activeOrder.displayId ?? activeOrder.orderNumber.slice(-8).toUpperCase()}
                </p>
                <p className="text-[13px] font-medium text-gray-900 truncate">{activeOrder.customerName}</p>
                <p className="text-[11px] font-bold text-gray-900 tabular-nums">
                  {formatCurrency(activeOrder.value)}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  );
}
