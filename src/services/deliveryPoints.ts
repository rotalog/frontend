import { api } from './api';

export interface DeliveryPointProofPayload {
  proof?: string;
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

export async function sendDeliveryProof(id: string, payload: DeliveryPointProofPayload | string) {
  const proof = typeof payload === 'string'
    ? payload
    : payload.proof ?? payload.note ?? payload.imageUrl ?? '';

  if (!proof.trim()) {
    throw new Error('Comprovante de entrega invalido.');
  }

  return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/proof`, {
    method: 'POST',
    body: JSON.stringify({ proof }),
  });
}

export async function failDeliveryPoint(id: string, payload: DeliveryPointFailPayload) {
  return api<{ id: string; status?: string; [key: string]: unknown }>(`/delivery-points/${id}/fail`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
