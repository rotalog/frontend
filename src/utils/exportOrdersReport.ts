import * as XLSX from 'xlsx';
import type { ApiOrder, ApiOrderItem } from '../types/orders';

const STATUS_TRANSLATIONS: Record<string, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
  PREPARING: 'Em preparo',
  DISPATCHED: 'Despachado',
  DELIVERED: 'Entregue',
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
  EM_SEPARACAO: 'Em separação',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
};

type LegacyOrderItem = {
  nome?: string;
  quantidade?: number;
  preco?: number;
};

type ExportableOrder = ApiOrder & {
  cliente?: string;
  itens?: LegacyOrderItem[];
  valorTotal?: number;
  dataDesejada?: string;
};

function translateStatus(status: unknown): string {
  if (typeof status !== 'string' || !status.trim()) {
    return 'Sem status';
  }

  const normalized = status.trim().toUpperCase();
  return STATUS_TRANSLATIONS[normalized] ?? status;
}

function getCustomerName(order: ExportableOrder): string {
  const customer = order.customer;
  const customerRecord = customer && typeof customer === 'object' ? customer as Record<string, unknown> : null;

  const value = order.cliente
    ?? order.buyerName
    ?? order.customerName
    ?? (typeof customerRecord?.name === 'string' ? customerRecord.name : undefined)
    ?? (typeof customerRecord?.fullName === 'string' ? customerRecord.fullName : undefined);

  return typeof value === 'string' && value.trim() ? value : 'Não informado';
}

function getOrderItems(order: ExportableOrder): Array<ApiOrderItem | LegacyOrderItem> {
  if (Array.isArray(order.items)) {
    return order.items;
  }

  if (Array.isArray(order.itens)) {
    return order.itens;
  }

  return [];
}

function getItemQuantity(item: ApiOrderItem | LegacyOrderItem): number {
  const quantityValue = 'quantity' in item ? item.quantity : item.quantidade;
  const quantity = Number(quantityValue ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function formatItems(items: Array<ApiOrderItem | LegacyOrderItem>): string {
  if (items.length === 0) {
    return 'Sem itens informados';
  }

  return items.map(item => {
    const name = 'productName' in item
      ? item.productName ?? item.name
      : ('nome' in item ? item.nome : undefined);
    const quantity = getItemQuantity(item);
    const safeName = typeof name === 'string' && name.trim() ? name : 'Item';
    return `${safeName} (${quantity} un.)`;
  }).join('; ');
}

function getItemsCount(items: Array<ApiOrderItem | LegacyOrderItem>): number {
  return items.reduce((sum, item) => sum + getItemQuantity(item), 0);
}

function getTotalAmount(order: ExportableOrder): number {
  const rawAmount = order.valorTotal ?? order.totalAmount ?? order.amount ?? order.value ?? 0;
  const parsed = Number(rawAmount);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Não informada';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
}

function getDeliveryAddress(order: ExportableOrder): string {
  const customer = order.customer;
  const customerRecord = customer && typeof customer === 'object' ? customer as Record<string, unknown> : null;
  const nestedAddress = customerRecord?.address;
  const nestedAddressText = typeof nestedAddress === 'string' ? nestedAddress : undefined;

  return order.deliveryAddress ?? nestedAddressText ?? 'Não informado';
}

export function exportOrdersToXlsx(orders: ExportableOrder[]): void {
  const headers = [
    'Código do pedido',
    'Cliente',
    'Status',
    'Quantidade de itens',
    'Itens do pedido',
    'Valor total',
    'Endereço de entrega',
    'Data do pedido',
  ];

  const rows = orders.map(order => {
    const items = getOrderItems(order);

    return {
      'Código do pedido': order.id,
      Cliente: getCustomerName(order),
      Status: translateStatus(order.status),
      'Quantidade de itens': getItemsCount(items),
      'Itens do pedido': formatItems(items),
      'Valor total': formatCurrency(getTotalAmount(order)),
      'Endereço de entrega': getDeliveryAddress(order),
      'Data do pedido': formatDate(order.createdAt ?? order.dataDesejada),
    };
  });

  const normalizedRows = rows.length > 0
    ? rows
    : [
      {
        'Código do pedido': 'Sem pedidos registrados',
        Cliente: '-',
        Status: '-',
        'Quantidade de itens': 0,
        'Itens do pedido': 'Nenhum pedido disponível para este fornecedor.',
        'Valor total': 'R$ 0,00',
        'Endereço de entrega': '-',
        'Data do pedido': '-',
      },
    ];

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows, {
    header: headers,
  });

  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 18 },
    { wch: 20 },
    { wch: 52 },
    { wch: 16 },
    { wch: 42 },
    { wch: 22 },
  ];

  worksheet['!autofilter'] = {
    ref: `A1:H${normalizedRows.length + 1}`,
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');
  XLSX.writeFile(workbook, 'relatorio-pedidos.xlsx', { compression: true });
}