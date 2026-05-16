export type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom' | string;

export interface DashboardReport {
  totalOrders?: number;
  totalRevenue?: number;
  pendingOrders?: number;
  deliveredOrders?: number;
  [key: string]: unknown;
}

export interface SalesReportParams {
  period?: ReportPeriod;
  from?: string;
  to?: string;
}

export interface SalesReportItem {
  date?: string;
  totalOrders?: number;
  totalRevenue?: number;
  [key: string]: unknown;
}

export interface TopProductsParams {
  period?: ReportPeriod;
  limit?: number;
}

export interface TopProductItem {
  productId?: string;
  productName?: string;
  quantitySold?: number;
  revenue?: number;
  [key: string]: unknown;
}

export interface AcceptanceRateReport {
  period?: ReportPeriod;
  accepted?: number;
  rejected?: number;
  acceptanceRate?: number;
  [key: string]: unknown;
}
