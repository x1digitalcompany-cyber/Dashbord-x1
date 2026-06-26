// ─── Filter ──────────────────────────────────────────────────────────────────

export type PeriodOption = "today" | "7d" | "30d" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface GlobalFilters {
  period: PeriodOption;
  dateRange: DateRange;
  /** Nome do vendedor (seller_name em orders). null = todos. */
  sellerName: string | null;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface KpiData {
  ads: {
    totalSpend: number;
    variationPct: number;
  };
  leads: {
    total: number;
    cpl: number; // custo por lead
    variationPct: number;
  };
  agendamentos: {
    total: number;
    conversionRate: number; // lead → agendamento %
    variationPct: number;
  };
  payt: {
    volume: number;
    transactions: number;
    variationPct: number;
  };
  pagarme: {
    volume: number;
    transactions: number;
    variationPct: number;
  };
}

// ─── Sellers / Agendamentos ───────────────────────────────────────────────────

export interface SellerAgendamento {
  sellerId: string;
  sellerName: string;
  agendamentos: number;
  meta?: number;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentStatus = "approved" | "pending" | "refunded" | "chargeback";
export type PaymentGateway = "pagarme" | "payt" | "five";

export interface PaymentRow {
  gateway: PaymentGateway;
  status: PaymentStatus;
  volume: number;
  count: number;
}

// ─── Orders / Kanban ─────────────────────────────────────────────────────────

export type KanbanColumn =
  | "pedidos_criados"
  | "em_transito"
  | "retirar_correios"
  | "pagos"
  | "devolvidos"
  | "inadimplentes";

export interface KanbanOrder {
  id: string;
  orderNumber: string;
  displayId?: string;       // últimos 8 chars do UUID em maiúsculo — exibir como #XXXXXXXX
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  customerDoc?: string;     // documento (CPF/CNPJ bruto do payload)
  value: number;
  paymentMethod: string;
  status: KanbanColumn;
  trackingCode?: string;
  trackingUrl?: string;
  shippingPlatform?: string;
  productName: string;
  offerTitle?: string;
  sellerName?: string;
  projectName?: string;
  addressFull?: string;     // logradouro + bairro formatado
  createdAt: string;        // ISO string
  updatedAt?: string;
  paidAt?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export type KanbanColumns = Record<KanbanColumn, KanbanOrder[]>;

export type KanbanOperationType = "antecipado" | "agendado";

export interface KanbanMetrics {
  total: number;
  paidValue: number;
  inadimplentesCount: number;
}

export interface KanbanApiResponse {
  columns: KanbanColumns;
  metrics: KanbanMetrics;
}

// ─── Module loading state ─────────────────────────────────────────────────────

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface ModuleState<T> {
  data: T | null;
  state: LoadingState;
  error?: string;
}

// ─── Financeiro ──────────────────────────────────────────────────────────────

export interface FinanceMetrics {
  faturamentoTotal: number;
  gastoAnuncios: number;
  lucroLiquido: number;
  roas: number;
  totalVendas: number;
  ticketMedio: number;
  leadsAtendidos: number;
  leadsPorVenda: number;
  taxaConversao: number;
  cpaMedio: number;
  inadimplenciaTotal: number;
  taxaInadimplencia: number;
  porTipo: {
    antecipado: { faturamento: number; vendas: number };
    payafter: { faturamento: number; vendas: number };
    agendado: { faturamento: number; vendas: number };
  };
}

export interface FinanceTimelinePoint {
  date: string;
  faturamento: number;
  gastoAnuncios: number;
  vendas: number;
}

export interface FinanceiroData {
  current: FinanceMetrics;
  previous: FinanceMetrics;
  variations: Partial<Record<keyof FinanceMetrics, number>>;
  timeline: FinanceTimelinePoint[];
  metaAdsError?: string;
}

export interface EstadoMetric {
  uf: string;
  vendas: number;
  faturamento: number;
  inadimplentes: number;
  valor_inadimplente: number;
  taxa_inadimplencia: number;
}

export interface AgendamentosExpanded {
  total: number;
  antecipado: number;
  payafter: number;
  taxaComparecimento: number;
  variationPct: number;
  daily: { date: string; count: number }[];
  bySeller: SellerAgendamento[];
}

export interface PagamentosExpanded {
  rows: PaymentRow[];
  totalVolume: number;
  totalCount: number;
  byGateway: { gateway: PaymentGateway; volume: number; count: number }[];
  recent: {
    id: string;
    orderNumber: string;
    customerName: string;
    value: number;
    gateway: PaymentGateway;
    status: PaymentStatus;
    createdAt: string;
  }[];
}
