import { api, ApiError } from './api';
import type { CreatePaymentPayload, PaymentResponse } from '../types/payments';

export async function createPayment(payload: CreatePaymentPayload): Promise<PaymentResponse> {
  const body: Record<string, unknown> = {
    orderId: payload.orderId,
  };

  if (typeof payload.amount === 'number') {
    body.amount = payload.amount;
  }

  if (typeof payload.method === 'string' && payload.method.trim()) {
    body.method = payload.method;
  }

  return api<PaymentResponse>('/payments/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPaymentByOrderId(orderId: string): Promise<PaymentResponse | null> {
  try {
    return await api<PaymentResponse>(`/payments/${orderId}`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}
