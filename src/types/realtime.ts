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

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_STATUS_CHANGED'
  | 'INVENTORY_UPDATED'
  | 'ROUTE_UPDATED'
  | 'DELIVERY_UPDATED'
  | string;

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload?: T;
  data?: T;
  timestamp?: string;
  [key: string]: unknown;
}

export interface RealtimeConnectionOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
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
