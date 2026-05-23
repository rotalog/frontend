export interface DashboardReport {
  openOrders?: number;
  availableUnits?: number;
  confirmedPayments?: number;
  newOrders?: number;
  preparingOrders?: number;
  billedToday?: number;
  acceptanceRate?: number;
  lowStockProducts?: unknown[];
  topProducts?: unknown[];
  [key: string]: unknown;
}

export interface SalesReport {
  totalRevenue?: number;
  totalOrders?: number;
  averageTicket?: number;
  period?: string;
  series?: unknown[];
  [key: string]: unknown;
}

export interface TopProductReport {
  productId?: string;
  productName?: string;
  name?: string;
  quantitySold?: number;
  totalRevenue?: number;
  [key: string]: unknown;
}

export interface AcceptanceRateReport {
  acceptanceRate?: number;
  acceptedOrders?: number;
  rejectedOrders?: number;
  totalOrders?: number;
  [key: string]: unknown;
}

export interface ExportReportResult {
  blob: Blob;
  filename: string;
  contentType: string;
}
