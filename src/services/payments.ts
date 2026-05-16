import { api } from './api';
import type { CreatePaymentPayload, PaymentStatus } from '../types/payments';

export async function createPayment(payload: CreatePaymentPayload) {
  return api<PaymentStatus>('/payments/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPaymentStatus(orderId: string) {
  return api<PaymentStatus>(`/payments/${orderId}`, {
    method: 'GET',
  });
}
