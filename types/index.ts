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
  /** YYYY-MM-DD — apenas quando period === 'custom' */
  customFrom?: string;
  customTo?: string;
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
  finance: {
    faturamentoTotal: number;
    gastoAnuncios: number;
    totalVendas: number;
    agendamentosCriados: number;
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
export type PaymentGateway = "pagarme" | "payt" | "five" | "braip";

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
  | "requer_atencao"   // DELIVERY_FAILED ou movido manualmente
  | "entregue"         // antecipado=final; agendado=aguardando pgto
  | "pagos"            // agendado only: pagamento confirmado
  | "devolvidos"
  | "inadimplentes";   // agendado only: pgto não recebido

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
  emTransitoCount: number;
  requerAtencaoCount: number;
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
  metaAdsConfigured?: boolean;
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

export interface PagarmePaymentStats {
  aprovados_valor: number;
  aprovados_count: number;
  pendentes_valor: number;
  pendentes_count: number;
  estornos_valor: number;
  estornos_count: number;
}

export interface PaytBraipPaymentStats {
  aprovados_valor: number;
  aprovados_count: number;
  pendentes_valor: number;
  pendentes_count: number;
  reembolsos_valor: number;
  reembolsos_count: number;
}

export interface PagamentosExpanded {
  pagarme: PagarmePaymentStats;
  payt: PaytBraipPaymentStats;
  braip: PaytBraipPaymentStats;
  total: { valor: number; transacoes: number };
}

// ─── PayAfter / Agendamentos ─────────────────────────────────────────────────

export interface PayafterKpis {
  agendamentos: number;
  convertidos: number;
  taxa_conversao: number;
  enviados: number;
  entregues: number;
  taxa_entrega: number;
  pagos: number;
  taxa_pagamento: number;
  em_risco_count: number;
  em_risco_valor: number;
  inadimplentes_count: number;
  inadimplentes_valor: number;
  devolvidos: number;
  taxa_devolucao: number;
  lucro_estimado: number;
  margem: number;
  variacao_agendamentos: number;
  gasto_anuncio: number;
  faturamento_pagos: number;
}

export interface PayafterAlert {
  id: string;
  severity: "red" | "yellow";
  message: string;
  target: "em-risco" | "inadimplentes";
  filter?: string;
  orderIds?: string[];
}

export interface PayafterFunnelStep {
  id: string;
  label: string;
  count: number;
  value: number;
  conversionPct: number;
  branch?: boolean;
}

export interface PayafterSellerExpanded {
  sellerId: string;
  sellerName: string;
  agendamentos: number;
  convertidos: number;
  taxaConversao: number;
  taxaInadimplencia: number;
}

export interface PayafterEmRiscoRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  value: number;
  updatedAt: string;
  daysDelivered: number;
  sellerName: string;
  urgency: "low" | "medium" | "high";
}

export interface PayafterInadimplenteRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCpf: string;
  customerPhone: string;
  value: number;
  sellerName: string;
  state: string;
  createdAt: string;
}

export interface PayafterDashboardData {
  kpis: PayafterKpis;
  alerts: PayafterAlert[];
  funnel: PayafterFunnelStep[];
  sellers: PayafterSellerExpanded[];
  daily: { date: string; count: number }[];
  weeklyPaymentRate: {
    week: string;
    label: string;
    taxa: number;
    entregues: number;
    pagos: number;
  }[];
  inadimplentes: PayafterInadimplenteRow[];
}
