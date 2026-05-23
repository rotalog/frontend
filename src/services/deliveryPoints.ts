import { api } from './api';
import type {
  ApiDeliveryPoint,
  DeliveryArrivePayload,
  DeliveryFailPayload,
  DeliveryProofPayload,
} from '../types/routes';

export async function arriveDeliveryPoint(pointId: string, payload?: DeliveryArrivePayload): Promise<ApiDeliveryPoint> {
  return api<ApiDeliveryPoint>(`/delivery-points/${pointId}/arrive`, {
    method: 'PUT',
    body: JSON.stringify({
      driverLatitude: payload?.driverLatitude,
      driverLongitude: payload?.driverLongitude,
    }),
  });
}

export async function sendDeliveryProof(pointId: string, payload: DeliveryProofPayload): Promise<ApiDeliveryPoint> {
  return api<ApiDeliveryPoint>(`/delivery-points/${pointId}/proof`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function failDeliveryPoint(pointId: string, payload: DeliveryFailPayload): Promise<ApiDeliveryPoint> {
  return api<ApiDeliveryPoint>(`/delivery-points/${pointId}/fail`, {
    method: 'PUT',
    body: JSON.stringify({
      reason: payload.reason,
    }),
  });
}
