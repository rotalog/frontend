export interface RoutePoint {
  id: string;
  orderId?: string;
  status?: string;
  sequence?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  [key: string]: unknown;
}

export interface ApiRoute {
  id: string;
  status?: string;
  date?: string;
  driverId?: string;
  vehicleId?: string;
  points?: RoutePoint[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface GenerateRoutePayload {
  date?: string;
  orderIds?: string[];
  supplierId?: string;
  [key: string]: unknown;
}
