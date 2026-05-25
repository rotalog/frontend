import { api } from './api';
import type {
  ApiSupplier,
  NearbySuppliersParams,
  UpdateSupplierPayload,
} from '../types/suppliers';

export async function getSuppliers() {
  return api<ApiSupplier[]>('/suppliers', {
    method: 'GET',
  });
}

export async function getSupplierById(id: string) {
  return api<ApiSupplier>(`/suppliers/${id}`, {
    method: 'GET',
  });
}

export async function updateSupplier(id: string, payload: UpdateSupplierPayload) {
  return api<ApiSupplier>(`/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getNearbySuppliers({ latitude, longitude, radiusMeters }: NearbySuppliersParams) {
  const params = new URLSearchParams({
    latitude: String(latitude ?? 0),
    longitude: String(longitude ?? 0),
    radiusMeters: String(radiusMeters ?? 0),
  });

  return api<ApiSupplier[]>(`/suppliers/nearby?${params.toString()}`, {
    method: 'GET',
  });
}
