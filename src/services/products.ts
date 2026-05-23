import { api, ApiError } from './api';
import type {
  ApiProduct,
  CreateProductPayload,
  UpdateProductPayload,
} from '../types/products';

export async function getSupplierProducts(supplierId: string): Promise<ApiProduct[]> {
  try {
    return await api<ApiProduct[]>(`/suppliers/${supplierId}/products`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createProduct(payload: CreateProductPayload): Promise<ApiProduct> {
  const minStockLevel = Number.isFinite(payload.minStockLevel)
    ? Number(payload.minStockLevel)
    : 0;

  return api<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      minStockLevel,
      imageUrl: payload.imageUrl,
    }),
  });
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<ApiProduct> {
  const body: UpdateProductPayload = {
    name: payload.name,
    imageUrl: payload.imageUrl,
  };

  if (payload.minStockLevel !== undefined) {
    body.minStockLevel = Number.isFinite(payload.minStockLevel)
      ? Number(payload.minStockLevel)
      : 0;
  }

  return api<ApiProduct>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return api<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}
