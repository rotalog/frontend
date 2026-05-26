import type { ApiInventoryItem } from '../types/inventory';
import type { ApiOrder } from '../types/orders';
import type { Order, OrderStatus, StockItem } from '../types/orders';

type GenericSource = Record<string, unknown> | null | undefined;

const ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  SOLICITADO: 'PENDENTE',
  PENDING: 'PENDENTE',
  PENDENTE: 'PENDENTE',
  NOVO: 'PENDENTE',
  NEW: 'PENDENTE',
  ACEITO: 'ACEITO',
  ACCEPTED: 'ACEITO',
  RESERVED: 'ACEITO',
  REJEITADO: 'REJEITADO',
  REJECTED: 'REJEITADO',
  CANCELLED: 'CANCELADO',
  CANCELED: 'CANCELADO',
  CANCELADO: 'CANCELADO',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
  PAYMENT_CONFIRMED: 'PAGAMENTO_CONFIRMADO',
  EM_SEPARACAO: 'EM_SEPARACAO',
  PREPARING: 'EM_SEPARACAO',
  SAIU_PARA_ENTREGA: 'SAIU_PARA_ENTREGA',
  DISPATCHED: 'SAIU_PARA_ENTREGA',
  ENTREGUE: 'ENTREGUE',
  DELIVERED: 'ENTREGUE',
  RECUSADO: 'RECUSADO',
  REJECTED_LEGACY: 'RECUSADO',
  CANCELLED_LEGACY: 'RECUSADO',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
  CANCELED: 'Cancelado',
  PREPARING: 'Em preparo',
  DISPATCHED: 'Despachado',
  DELIVERED: 'Entregue',
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function getNumberValue(source: GenericSource, possibleKeys: string[], fallback = 0): number {
  if (!source || typeof source !== 'object') {
    return fallback;
  }

  for (const key of possibleKeys) {
    if (!(key in source)) {
      continue;
    }

    const value = source[key];
    const parsed = toNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeOrderStatus(rawStatus: unknown): { status: OrderStatus; statusDisplay?: string } {
  const normalized = toString(rawStatus, 'PENDING').toUpperCase();
  const mappedStatus = ORDER_STATUS_MAP[normalized];

  if (mappedStatus) {
    return {
      status: mappedStatus,
      statusDisplay: STATUS_LABEL_MAP[normalized],
    };
  }

  const original = toString(rawStatus).trim();
  return {
    status: 'PENDENTE',
    statusDisplay: original || undefined,
  };
}

function isRejectedStatus(status: OrderStatus) {
  return status === 'REJEITADO' || status === 'CANCELADO' || status === 'RECUSADO';
}

function isPendingStatus(status: OrderStatus) {
  return status === 'PENDENTE' || status === 'SOLICITADO';
}

function mapApiOrderItem(item: unknown) {
  const source = (item && typeof item === 'object') ? item as Record<string, unknown> : {};

  return {
    nome: toString(
      source.productName ?? source.name ?? source.nome,
      'Item',
    ),
    quantidade: getNumberValue(source, ['quantity', 'quantidade', 'qty'], 0),
    preco: getNumberValue(source, ['unitPrice', 'preco', 'price', 'valorUnitario'], 0),
  };
}

export function mapApiOrderToLegacyOrder(apiOrder: ApiOrder): Order {
  const source = apiOrder as Record<string, unknown>;
  const id = toString(source.id, `PED-${Date.now()}`);
  const normalizedStatus = normalizeOrderStatus(source.status);
  const itemsRaw = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.itens)
      ? source.itens
      : [];

  const itens = itemsRaw.map(mapApiOrderItem);
  const totalFromItems = itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

  return {
    id,
    cliente: toString(
      source.customerName ?? source.buyerName ?? source.cliente ?? source.customer,
      'Cliente',
    ),
    valorTotal: getNumberValue(source, ['totalAmount', 'amount', 'value', 'valorTotal', 'total'], totalFromItems),
    status: normalizedStatus.status,
    statusDisplay: normalizedStatus.statusDisplay,
    dataDesejada: toString(
      source.desiredDate ?? source.deliveryDate ?? source.createdAt,
      new Date().toISOString().slice(0, 10),
    ),
    deliveryAddress: toString(source.deliveryAddress),
    itens,
  };
}

export function mapApiInventoryToLegacyStock(apiInventory: ApiInventoryItem): StockItem {
  const source = apiInventory as unknown as Record<string, unknown>;
  const productName = toString(source.productName ?? source.name ?? source.produto, 'Produto');
  const photoUrl = toString(source.photoUrl ?? source.fotoUrl);
  const totalQuantity = getNumberValue(source, ['totalQuantity', 'quantity', 'total'], 0);
  const reservedQuantity = getNumberValue(source, ['reservedQuantity', 'reserved', 'reservado'], 0);
  const availableQuantity = getNumberValue(source, ['availableQuantity', 'available', 'disponivel'], Math.max(0, totalQuantity - reservedQuantity));

  return {
    codigo: toString(source.sku ?? source.codigo ?? source.productId, productName.toUpperCase().replace(/\s+/g, '-')),
    produto: productName,
    total: totalQuantity,
    reservado: reservedQuantity,
    fotoUrl: photoUrl || undefined,
    id: toString(source.productId ?? source.id),
    productId: toString(source.productId ?? source.id),
    inventoryId: toString(source.inventoryId),
    supplierId: toString(source.supplierId),
    totalQuantity,
    reservedQuantity,
    availableQuantity,
    badges: Array.isArray(source.badges)
      ? source.badges.filter((badge): badge is string => typeof badge === 'string')
      : [],
  } as StockItem;
}

export function calculateFallbackKpis(orders: Order[], inventory: StockItem[]) {
  const validOrders = orders.filter(order => !isRejectedStatus(order.status));
  const acceptedOrders = orders.filter(order => !isPendingStatus(order.status) && !isRejectedStatus(order.status));
  const rejectedOrders = orders.filter(order => isRejectedStatus(order.status)).length;
  const pendingOrders = orders.filter(order => isPendingStatus(order.status)).length;
  const preparingOrders = orders.filter(order => order.status === 'EM_SEPARACAO').length;
  const deliveriesInProgress = orders.filter(order => order.status === 'SAIU_PARA_ENTREGA').length;
  const completedDeliveries = orders.filter(order => order.status === 'ENTREGUE').length;

  const revenueToday = validOrders.reduce((sum, order) => sum + order.valorTotal, 0);
  const acceptanceRate = orders.length > 0
    ? Math.round((acceptedOrders.length / orders.length) * 100)
    : 0;

  const lowStockCount = inventory.filter(item => {
    const stockItem = item as StockItem & { minStockLevel?: number; availableQuantity?: number };
    const minStockLevel = typeof stockItem.minStockLevel === 'number' && Number.isFinite(stockItem.minStockLevel)
      ? stockItem.minStockLevel
      : 0;
    const available = typeof stockItem.availableQuantity === 'number' && Number.isFinite(stockItem.availableQuantity)
      ? stockItem.availableQuantity
      : item.total - item.reservado;

    return minStockLevel > 0 && available <= minStockLevel;
  }).length;

  const productTotals = validOrders.reduce<Record<string, number>>((acc, order) => {
    order.itens.forEach(item => {
      acc[item.nome] = (acc[item.nome] ?? 0) + item.quantidade;
    });
    return acc;
  }, {});

  const maxProductTotal = Math.max(...Object.values(productTotals), 1);
  const topProducts = Object.entries(productTotals)
    .sort(([, firstTotal], [, secondTotal]) => secondTotal - firstTotal)
    .slice(0, 4)
    .map(([name, total]) => ({
      name,
      percent: Math.round((total / maxProductTotal) * 100),
    }));

  return {
    totalOrders: orders.length,
    pendingOrders,
    preparingOrders,
    acceptedOrders: acceptedOrders.length,
    rejectedOrders,
    revenueToday,
    monthlyOrders: validOrders.length,
    acceptanceRate,
    lowStockCount,
    deliveriesInProgress,
    completedDeliveries,
    topProducts,
  };
}
