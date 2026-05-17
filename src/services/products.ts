import { api } from './api';
import type {
  ApiProduct,
  CreateProductPayload,
  UpdateProductPayload,
} from '../types/products';

export async function getSupplierProducts(supplierId: string) {
  return api<ApiProduct[]>(`/suppliers/${supplierId}/products`, {
    method: 'GET',
  });
}

export async function createProduct(payload: CreateProductPayload) {
  const minStockLevel = Number.isFinite(payload.minStockLevel)
    ? Number(payload.minStockLevel)
    : 0;

  return api<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      minStockLevel,
    }),
  });
}

export async function updateProduct(id: string, payload: UpdateProductPayload) {
  const minStockLevel = Number.isFinite(payload.minStockLevel)
    ? Number(payload.minStockLevel)
    : 0;

  return api<ApiProduct>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name,
      minStockLevel,
    }),
  });
}

export async function deleteProduct(id: string) {
  return api<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}
