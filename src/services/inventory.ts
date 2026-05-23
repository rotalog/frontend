import { api, ApiError } from './api';
import type {
  ApiInventoryItem,
  InventoryMovement,
  UpdateInventoryPayload,
} from '../types/inventory';

export async function getInventory(): Promise<ApiInventoryItem[]> {
  try {
    return await api<ApiInventoryItem[]>('/inventory', { method: 'GET' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function updateInventory(productId: string, payload: UpdateInventoryPayload) {
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('A quantidade de entrada deve ser maior que zero.');
  }

  return api<ApiInventoryItem>(`/inventory/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      quantity: payload.quantity,
      reason: payload.reason,
    }),
  });
}

export async function getInventoryMovements() {
  return api<InventoryMovement[]>('/inventory/movements', {
    method: 'GET',
  });
}

export async function importInventoryCsv(file: File) {
  const csvContent = await file.text();

  return api<{ imported?: number; [key: string]: unknown }>('/inventory/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
    },
    body: csvContent,
  });
}
