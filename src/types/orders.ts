// src/types/orders.ts
export type OrderStatus =
  | 'PENDENTE'
  | 'SOLICITADO'
  | 'ACEITO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'PAGAMENTO_CONFIRMADO'
  | 'EM_SEPARACAO'
  | 'SAIU_PARA_ENTREGA'
  | 'ENTREGUE'
  | 'RECUSADO';

export interface Order {
  id: string;
  cliente: string;
  valorTotal: number;
  status: OrderStatus;
  dataDesejada: string;
  itens: Array<{ nome: string; quantidade: number; preco: number }>;
  statusDisplay?: string;
  deliveryAddress?: string;
}

export interface StockItem {
  codigo: string;
  produto: string;
  total: number;
  reservado: number;
  fotoUrl?: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  description: string;
  createdAt: string;
}

export type StockMovementType = 'ENTRY' | 'RESERVATION' | 'RELEASE' | 'EXIT';

export interface StockMovement {
  id: string;
  product: string;
  type: StockMovementType;
  quantity: number;
  source: string;
  createdAt: string;
}

export type ApiOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PREPARING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | string;

export interface ApiOrderItem {
  productId?: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  total?: number;
}

export interface ApiOrder {
  id: string;
  status: ApiOrderStatus;
  totalAmount?: number;
  amount?: number;
  value?: number;
  createdAt?: string;
  updatedAt?: string;
  items?: ApiOrderItem[];
  buyerName?: string;
  customerName?: string;
  customer?: unknown;
  deliveryAddress?: string;
  [key: string]: unknown;
}

export interface CreateOrderPayload {
  customerId?: string;
  supplierId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice?: number;
    [key: string]: unknown;
  }>;
  notes?: string;
  [key: string]: unknown;
}

export interface RejectOrderPayload {
  reason?: string;
  [key: string]: unknown;
}

export interface OrderTrackingResponse {
  orderId?: string;
  status?: string;
  events?: unknown[];
  [key: string]: unknown;
}