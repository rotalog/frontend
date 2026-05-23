import { api, ApiError } from './api';
import type { ApiDeliveryPoint, ApiRoute, GenerateRoutePayload } from '../types/routes';

export async function generateRoute(payload: GenerateRoutePayload): Promise<ApiRoute> {
  return api<ApiRoute>('/routes/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTodayRoutes(): Promise<ApiRoute[]> {
  try {
    const response = await api<ApiRoute[] | ApiRoute>('/routes/today', { method: 'GET' });
    return Array.isArray(response) ? response : [response];
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getRoutes(): Promise<ApiRoute[]> {
  try {
    return await api<ApiRoute[]>('/routes', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function startRoute(routeId: string): Promise<ApiRoute> {
  return api<ApiRoute>(`/routes/${routeId}/start`, {
    method: 'PUT',
  });
}

export async function completeRoute(routeId: string): Promise<ApiRoute> {
  return api<ApiRoute>(`/routes/${routeId}/complete`, {
    method: 'PUT',
  });
}

export async function getRoutePoints(routeId: string): Promise<ApiDeliveryPoint[]> {
  try {
    return await api<ApiDeliveryPoint[]>(`/routes/${routeId}/points`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

// Compatibility alias used by existing imports.
export const getTodayRoute = getTodayRoutes;
