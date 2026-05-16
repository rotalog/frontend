import { api } from './api';

export interface DeliveryPointProofPayload {
  note?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface DeliveryPointFailPayload {
  reason: string;
  note?: string;
  [key: string]: unknown;
}

export async function arriveDeliveryPoint(id: string) {
  return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/arrive`, {
    method: 'PUT',
  });
}

export async function sendDeliveryProof(id: string, payload: DeliveryPointProofPayload | FormData) {
  if (payload instanceof FormData) {
    return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/proof`, {
      method: 'POST',
      body: payload,
    });
  }

  return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/proof`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function failDeliveryPoint(id: string, payload: DeliveryPointFailPayload) {
  return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/fail`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
