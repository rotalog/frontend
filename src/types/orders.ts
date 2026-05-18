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
}

export interface StockItem {
  productId: string;
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
  | 'RESERVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CANCELED'
  | 'PREPARING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | string;

export interface ApiOrderItem {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  [key: string]: unknown;
}

export interface ApiOrder {
  id: string;
  status: ApiOrderStatus;
  totalAmount?: number;
  customerName?: string;
  customerId?: string;
  supplierId?: string;
  items?: ApiOrderItem[];
  createdAt?: string;
  updatedAt?: string;
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

export interface OrderTrackingEvent {
  status: string;
  description?: string;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface OrderTracking {
  orderId: string;
  currentStatus?: string;
  events?: OrderTrackingEvent[];
  [key: string]: unknown;
}