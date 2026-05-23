import { api, ApiError } from './api';
import type {
  ApiOrder,
  CreateOrderPayload,
  OrderTracking,
} from '../types/orders';

export async function getOrders(): Promise<ApiOrder[]> {
  try {
    return await api<ApiOrder[]>('/orders', { method: 'GET' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getOrderById(id: string) {
  return api<ApiOrder>(`/orders/${id}`, {
    method: 'GET',
  });
}

export async function createOrder(payload: CreateOrderPayload) {
  return api<ApiOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function acceptOrder(id: string) {
  return api<ApiOrder>(`/orders/${id}/accept`, {
    method: 'PUT',
  });
}

export async function rejectOrder(id: string, reason?: string) {
  void reason;
  return api<ApiOrder>(`/orders/${id}/reject`, {
    method: 'PUT',
  });
}

export async function cancelOrder(id: string) {
  return api<ApiOrder>(`/orders/${id}/cancel`, {
    method: 'PUT',
  });
}

export async function prepareOrder(id: string) {
  return api<ApiOrder>(`/orders/${id}/prepare`, {
    method: 'PUT',
  });
}

export async function dispatchOrder(id: string) {
  return api<ApiOrder>(`/orders/${id}/dispatch`, {
    method: 'PUT',
  });
}

export async function getOrderTracking(id: string) {
  return api<OrderTracking>(`/orders/${id}/tracking`, {
    method: 'GET',
  });
}
