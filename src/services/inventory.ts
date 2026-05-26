import { api, ApiError } from './api';
import type {
  InventoryAdjustmentPayload,
  InventoryResponse,
  StockMovementResponse,
} from '../types/inventory';

export async function getInventory(): Promise<InventoryResponse[]> {
  try {
    return await api<InventoryResponse[]>('/inventory', { method: 'GET' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function updateInventory(
  productId: string,
  payload: InventoryAdjustmentPayload,
): Promise<InventoryResponse> {
  if (!isInventoryProductId(productId)) {
    throw new Error('ID de produto invalido para sincronizar estoque.');
  }

  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('A quantidade de entrada deve ser maior que zero.');
  }

  return api<InventoryResponse>(`/inventory/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      quantity: payload.quantity,
      reason: payload.reason,
    }),
  });
}

export async function getInventoryMovements(): Promise<StockMovementResponse[]> {
  try {
    return await api<StockMovementResponse[]>('/inventory/movements', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function importInventoryCsv(csvContent: string): Promise<void> {
  return api<void>('/inventory/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
    },
    body: csvContent,
  });
}

export function isInventoryProductId(value?: string): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
