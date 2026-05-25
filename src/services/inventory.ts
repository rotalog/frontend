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
