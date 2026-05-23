export type ApiRouteStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | string;

export type ApiDeliveryPointStatus =
  | 'PENDING'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | string;

export interface ApiDeliveryPoint {
  id: string;
  routeId?: string;
  orderId?: string;
  status?: ApiDeliveryPointStatus;
  address?: string;
  latitude?: number;
  longitude?: number;
  sequence?: number;
  proofUrl?: string;
  failureReason?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  [key: string]: unknown;
}

export interface ApiRoute {
  id: string;
  supplierId?: string;
  driverId?: string;
  status?: ApiRouteStatus;
  totalDistanceKm?: number;
  estimatedDurationMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  deliveryPoints?: ApiDeliveryPoint[];
  [key: string]: unknown;
}

export interface GenerateRoutePayload {
  driverId: string;
  stops: GenerateRouteStop[];
  date?: string;
}

export interface GenerateRouteStop {
  orderId: string;
  latitude: number;
  longitude: number;
}

export interface DeliveryProofPayload {
  proofUrl?: string;
  proof?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface DeliveryFailPayload {
  reason: string;
}

export interface DeliveryArrivePayload {
  driverLatitude?: number;
  driverLongitude?: number;
}

// Compatibility alias used by older code paths.
export type RoutePoint = ApiDeliveryPoint;
