export interface TrackingLocationPayload {
  orderId?: string;
  routeId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  [key: string]: unknown;
}

export interface OrderNotificationPayload {
  orderId?: string;
  supplierId?: string;
  status?: string;
  message?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface RouteLocationPayload {
  routeId?: string;
  driverId?: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  [key: string]: unknown;
}
