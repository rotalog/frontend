import { api } from './api';
import type { ApiRoute, GenerateRoutePayload, RoutePoint } from '../types/routes';

export async function generateRoute(payload: GenerateRoutePayload) {
  return api<ApiRoute>('/routes/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTodayRoute() {
  return api<ApiRoute[]>('/routes/today', {
    method: 'GET',
  });
}

export async function getRoutes() {
  return api<ApiRoute[]>('/routes', {
    method: 'GET',
  });
}

export async function startRoute(id: string) {
  return api<ApiRoute>(`/routes/${id}/start`, {
    method: 'PUT',
  });
}

export async function completeRoute(id: string) {
  return api<ApiRoute>(`/routes/${id}/complete`, {
    method: 'PUT',
  });
}

export async function getRoutePoints(id: string) {
  return api<RoutePoint[]>(`/routes/${id}/points`, {
    method: 'GET',
  });
}
