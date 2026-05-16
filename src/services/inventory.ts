import { api } from './api';
import type {
  ApiInventoryItem,
  InventoryMovement,
  UpdateInventoryPayload,
} from '../types/inventory';

export async function getInventory() {
  return api<ApiInventoryItem[]>('/inventory', {
    method: 'GET',
  });
}

export async function updateInventory(productId: string, payload: UpdateInventoryPayload) {
  return api<ApiInventoryItem>(`/inventory/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getInventoryMovements() {
  return api<InventoryMovement[]>('/inventory/movements', {
    method: 'GET',
  });
}

export async function importInventoryCsv(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return api<{ imported?: number; [key: string]: unknown }>('/inventory/import', {
    method: 'POST',
    body: formData,
  });
}
