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
  return api<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: string, payload: UpdateProductPayload) {
  return api<ApiProduct>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: string) {
  return api<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}
