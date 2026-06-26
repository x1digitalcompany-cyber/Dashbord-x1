"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  Truck,
  MapPin,
  CheckCircle2,
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
import { applyKanbanSearch, isKanbanColumn } from "@/lib/kanban-utils";
import { cn, formatCurrency, formatDatetime, timeAgo } from "@/lib/utils";
import type { KanbanColumn, KanbanColumns, KanbanOrder } from "@/types";

interface ColumnDef {
  id: KanbanColumn;
  label: string;
  shortLabel: string;
  headerBg: string;
  dotColor: string;
  Icon: React.ElementType;
}

const COLUMNS: ColumnDef[] = [
  { id: "pedidos_criados",  label: "Pedidos Criados",  shortLabel: "Criados",     headerBg: "bg-blue-50",   dotColor: "bg-[#3B8BD4]", Icon: PackagePlus },
  { id: "em_transito",      label: "Em Trânsito",      shortLabel: "Em Trânsito", headerBg: "bg-violet-50", dotColor: "bg-[#7C3AED]", Icon: Truck },
  { id: "retirar_correios", label: "Retirar Correios", shortLabel: "Correios",    headerBg: "bg-amber-50",  dotColor: "bg-[#EF9F27]", Icon: MapPin },
  { id: "pagos",            label: "Pagos",            shortLabel: "Pagos",       headerBg: "bg-green-50",  dotColor: "bg-[#639922]", Icon: CheckCircle2 },
  { id: "devolvidos",       label: "Devolvidos",       shortLabel: "Devolvidos",  headerBg: "bg-red-50",    dotColor: "bg-[#A32D2D]", Icon: RotateCcw },
  { id: "inadimplentes",    label: "Inadimplentes",    shortLabel: "Inadimp.",    headerBg: "bg-rose-50",   dotColor: "bg-[#993556]", Icon: AlertCircle },
];

const PAYMENT_ICON: Record<string, React.ElementType> = {
  PIX:    QrCode,
  CARD:   CreditCard,
  BOLETO: FileText,
};

const STATUS_BADGE_VARIANT: Record<KanbanColumn, "blue" | "violet" | "amber" | "green" | "red" | "rose"> = {
  pedidos_criados:  "blue",
  em_transito:      "violet",
  retirar_correios: "amber",
  pagos:            "green",
  devolvidos:       "red",
  inadimplentes:    "rose",
};

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
        "bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-xs font-bold text-indigo-600">#{shortId}</span>
        <span className="text-xs font-bold text-gray-900 tabular-nums shrink-0">
          {formatCurrency(order.value)}
        </span>
      </div>

      <p className="text-sm font-medium text-gray-900 truncate mb-1">
        {order.customerName}
      </p>

      {order.trackingCode && (
        <div className="flex items-center gap-1 mb-1 text-xs text-gray-400">
          <Truck size={11} className="shrink-0" />
          <span className="font-mono truncate">{order.trackingCode}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50">
        <span className="text-xs text-gray-400">
          {timeAgo(order.updatedAt ?? order.createdAt)}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
        >
          Ver detalhes →
        </button>
      </div>
    </div>
  );
}

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
    <div className="flex flex-col w-full">
      <div className={cn("flex items-center gap-1.5 px-2.5 py-2 rounded-xl mb-2", column.headerBg)}>
        <span className={cn("w-2 h-2 rounded-full shrink-0", column.dotColor)} />
        <column.Icon size={12} className="text-gray-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 flex-1 min-w-0 leading-tight">
          {column.shortLabel}
        </span>
        <span className="text-xs font-bold text-gray-500 bg-white/70 rounded-full px-1.5 py-0.5 shrink-0">
          {orders.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-[120px] rounded-xl p-1 transition-colors",
          isOver && "bg-indigo-50/60 ring-2 ring-indigo-200 ring-inset"
        )}
      >
        {orders.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-300 select-none">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: KanbanOrder | null; onClose: () => void }) {
  if (!order) return null;
  const PayIcon = PAYMENT_ICON[order.paymentMethod] ?? CreditCard;
  const displayId = order.displayId ?? order.orderNumber.slice(-8).toUpperCase();

  return (
    <Modal open={!!order} onClose={onClose} title={`#${displayId}`}>
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

interface KanbanFiveProps {
  data: KanbanColumns | null;
  loading?: boolean;
  error?: string;
  title?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onMove?: (orderId: string, newColumn: KanbanColumn) => Promise<void>;
}

export function KanbanFive({
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  useEffect(() => {
    if (data !== null) setColumns(data);
  }, [data]);

  const displayColumns = useMemo(
    () => (columns ? applyKanbanSearch(columns, search) : null),
    [columns, search]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [loading, displayColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const findOrder = useCallback(
    (id: string): { order: KanbanOrder; col: KanbanColumn } | null => {
      if (!columns) return null;
      for (const col of COLUMNS) {
        const order = columns[col.id].find((o) => o.id === id);
        if (order) return { order, col: col.id };
      }
      return null;
    },
    [columns]
  );

  const resolveTargetColumn = useCallback(
    (over: DragOverEvent["over"] | DragEndEvent["over"]): KanbanColumn | null => {
      if (!over) return null;

      const dataCol = over.data.current?.columnId;
      if (typeof dataCol === "string" && isKanbanColumn(dataCol)) {
        return dataCol;
      }
      if (isKanbanColumn(String(over.id))) {
        return over.id as KanbanColumn;
      }

      const found = findOrder(String(over.id));
      return found?.col ?? null;
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {COLUMNS.map((c) => (
            <div key={c.id} className="space-y-2 min-w-[200px] flex-1">
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

  const currentColumns = displayColumns ?? ({} as KanbanColumns);
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
                placeholder="Buscar #código, cliente ou rastreio…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-64"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-10 rounded-l-xl" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10 rounded-r-xl" />
          )}

          <div
            ref={scrollRef}
            className="overflow-x-auto pb-1"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-6 gap-3 min-w-[1260px]">
                {COLUMNS.map((col) => (
                  <KanbanColumnComponent
                    key={col.id}
                    column={col}
                    orders={currentColumns[col.id] ?? []}
                    onCardClick={setSelectedOrder}
                    activeId={activeId}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeOrder && (
                  <div className="bg-white rounded-xl border border-indigo-200 shadow-xl p-3 rotate-2 opacity-95 w-[200px]">
                    <p className="text-xs font-bold text-indigo-600">
                      #{activeOrder.displayId ?? activeOrder.orderNumber.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-sm font-medium text-gray-900">{activeOrder.customerName}</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatCurrency(activeOrder.value)}
                    </p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  );
}
