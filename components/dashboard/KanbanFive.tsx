"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
} from "@dnd-kit/core";
import {
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Search,
  X,
  ExternalLink,
  CreditCard,
  QrCode,
  FileText,
  MapPin,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDatetime, timeAgo } from "@/lib/utils";
import type { KanbanColumn, KanbanColumns, KanbanOrder } from "@/types";

// ─── Column config ────────────────────────────────────────────────────────────

interface ColumnDef {
  id: KanbanColumn;
  label: string;
  headerBg: string;
  dotColor: string;
  Icon: React.ElementType;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "chegou",
    label: "Chegou",
    headerBg: "bg-blue-50",
    dotColor: "bg-blue-500",
    Icon: Package,
  },
  {
    id: "retirar_correios",
    label: "Retirar nos Correios",
    headerBg: "bg-amber-50",
    dotColor: "bg-amber-500",
    Icon: Truck,
  },
  {
    id: "pagos",
    label: "Pagos",
    headerBg: "bg-emerald-50",
    dotColor: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  {
    id: "devolvidos",
    label: "Devolvidos",
    headerBg: "bg-red-50",
    dotColor: "bg-red-500",
    Icon: RotateCcw,
  },
  {
    id: "inadimplentes",
    label: "Inadimplentes",
    headerBg: "bg-rose-50",
    dotColor: "bg-rose-600",
    Icon: AlertTriangle,
  },
];

const PAYMENT_ICON: Record<string, React.ElementType> = {
  PIX: QrCode,
  CARD: CreditCard,
  BOLETO: FileText,
};

const STATUS_BADGE_VARIANT: Record<KanbanColumn, "blue" | "amber" | "green" | "red" | "rose"> = {
  chegou: "blue",
  retirar_correios: "amber",
  pagos: "green",
  devolvidos: "red",
  inadimplentes: "rose",
};

// ─── KanbanCard ───────────────────────────────────────────────────────────────

function KanbanCard({
  order,
  onClick,
  isDragging,
}: {
  order: KanbanOrder;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: order.id });
  const PayIcon = PAYMENT_ICON[order.paymentMethod] ?? CreditCard;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-grab active:cursor-grabbing select-none transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-bold text-indigo-600">{order.orderNumber}</span>
            <PayIcon size={11} className="text-gray-400 shrink-0" />
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{order.customerName}</p>
          {order.sellerName && (
            <p className="text-xs text-gray-400 truncate">{order.sellerName}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900 tabular-nums">
            {formatCurrency(order.value)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(order.updatedAt ?? order.createdAt)}</p>
        </div>
      </div>

      {order.trackingCode && (
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1 text-xs text-gray-400">
          <Truck size={11} />
          <span className="font-mono truncate">{order.trackingCode}</span>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="mt-2 w-full text-xs text-indigo-500 hover:text-indigo-700 hover:underline text-left transition-colors"
      >
        Ver detalhes →
      </button>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumnComponent({
  column,
  orders,
  search,
  onCardClick,
  activeId,
}: {
  column: ColumnDef;
  orders: KanbanOrder[];
  search: string;
  onCardClick: (order: KanbanOrder) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const filtered = orders.filter(
    (o) =>
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-w-0 w-full">
      <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2", column.headerBg)}>
        <span className={cn("w-2 h-2 rounded-full shrink-0", column.dotColor)} />
        <column.Icon size={13} className="text-gray-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 truncate flex-1">
          {column.label}
        </span>
        <span className="text-xs font-bold text-gray-500 bg-white/70 rounded-full px-1.5 py-0.5">
          {filtered.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-[120px] rounded-xl p-1 transition-colors",
          isOver && "bg-indigo-50/60 ring-2 ring-indigo-200 ring-inset"
        )}
      >
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-300 select-none">
            {search ? "Nenhum resultado" : "Vazio"}
          </div>
        )}
        {filtered.map((order) => (
          <KanbanCard
            key={order.id}
            order={order}
            onClick={() => onCardClick(order)}
            isDragging={activeId === order.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose }: { order: KanbanOrder | null; onClose: () => void }) {
  if (!order) return null;
  const PayIcon = PAYMENT_ICON[order.paymentMethod] ?? CreditCard;

  return (
    <Modal open={!!order} onClose={onClose} title={`Pedido ${order.orderNumber}`}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
            {COLUMNS.find((c) => c.id === order.status)?.label ?? order.status}
          </Badge>
          <span className="text-xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(order.value)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
            <p className="font-medium text-gray-900">{order.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">CPF</p>
            <p className="font-mono text-gray-700">{order.customerCpf || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
            <p className="text-gray-700 truncate">{order.customerEmail || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Telefone</p>
            <p className="text-gray-700">{order.customerPhone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Produto</p>
            <p className="text-gray-900 font-medium">{order.productName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
            <p className="text-gray-700">{order.sellerName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Pagamento</p>
            <div className="flex items-center gap-1.5">
              <PayIcon size={13} className="text-gray-500" />
              <span className="text-gray-700">{order.paymentMethod}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Data do pedido</p>
            <p className="text-gray-700">{formatDatetime(order.createdAt)}</p>
          </div>
          {order.paidAt && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pago em</p>
              <p className="text-gray-700">{formatDatetime(order.paidAt)}</p>
            </div>
          )}
        </div>

        {order.trackingCode && (
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <p className="text-xs text-gray-400 mb-1">Rastreamento</p>
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

        {order.address && (
          <div className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} className="text-gray-400" />
              <p className="text-xs text-gray-400">Endereço de entrega</p>
            </div>
            <p className="text-gray-700">
              {order.address.street}, {order.address.number}
              {order.address.complement ? ` — ${order.address.complement}` : ""}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              {order.address.neighborhood}, {order.address.city}/{order.address.state} — CEP{" "}
              {order.address.zipCode}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KanbanFiveProps {
  data: KanbanColumns | null;
  loading?: boolean;
  error?: string;
  title?: string;
  onMove?: (orderId: string, newColumn: KanbanColumn) => Promise<void>;
}

export function KanbanFive({ data, loading, error, title = "Kanban Five", onMove }: KanbanFiveProps) {
  const [columns, setColumns] = useState<KanbanColumns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<KanbanOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<KanbanOrder | null>(null);
  const [search, setSearch] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);

  // Sync: sempre que o pai passa novos dados, atualiza o estado interno
  useEffect(() => {
    if (data !== null) setColumns(data);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findOrder = useCallback(
    (id: string): { order: KanbanOrder; col: KanbanColumn } | null => {
      if (!columns) return null;
      for (const col of Object.keys(columns) as KanbanColumn[]) {
        const order = columns[col].find((o) => o.id === id);
        if (order) return { order, col };
      }
      return null;
    },
    [columns]
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

    const targetCol = over.id as KanbanColumn;
    if (found.col === targetCol) return;

    // Salva estado anterior para rollback
    const prevColumns = columns;

    // Atualização otimista
    const next = { ...columns };
    next[found.col] = next[found.col].filter((o) => o.id !== active.id);
    next[targetCol] = [{ ...found.order, status: targetCol }, ...next[targetCol]];
    setColumns(next);

    // Persiste no banco — rollback em caso de falha
    onMove?.(active.id as string, targetCol)?.catch(() => {
      setColumns(prevColumns);
      setMoveError("Falha ao mover pedido — alteração revertida");
      setTimeout(() => setMoveError(null), 4000);
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="grid grid-cols-5 gap-3">
          {COLUMNS.map((c) => (
            <div key={c.id} className="space-y-2">
              <Skeleton className="h-9 w-full rounded-xl" />
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

  const currentColumns = columns ?? ({} as KanbanColumns);
  const totalOrders = Object.values(currentColumns).flat().length;

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{totalOrders} pedidos</p>
          </div>

          <div className="flex items-center gap-3">
            {moveError && (
              <span className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                {moveError}
              </span>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar pedido ou cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-3">
            {COLUMNS.map((col) => (
              <KanbanColumnComponent
                key={col.id}
                column={col}
                orders={currentColumns[col.id] ?? []}
                search={search}
                onCardClick={setSelectedOrder}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeOrder && (
              <div className="bg-white rounded-xl border border-indigo-200 shadow-xl p-3 rotate-2 opacity-95">
                <p className="text-xs font-bold text-indigo-600">{activeOrder.orderNumber}</p>
                <p className="text-sm font-medium text-gray-900">{activeOrder.customerName}</p>
                <p className="text-sm font-bold text-gray-900 tabular-nums">
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
