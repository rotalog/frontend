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

export async function getNearbySuppliers({ latitude, longitude, radiusMeters, lat, lng, radius }: NearbySuppliersParams) {
  const normalizedLatitude = latitude ?? lat ?? 0;
  const normalizedLongitude = longitude ?? lng ?? 0;
  const normalizedRadiusMeters = radiusMeters ?? radius ?? 0;
  const params = new URLSearchParams({
    latitude: String(normalizedLatitude),
    longitude: String(normalizedLongitude),
    radiusMeters: String(normalizedRadiusMeters),
  });

  return api<ApiSupplier[]>(`/suppliers/nearby?${params.toString()}`, {
    method: 'GET',
  });
}
