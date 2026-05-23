import { api, API_URL, ApiError } from './api';
import type {
  AcceptanceRateReport,
  DashboardReport,
  EmptyDashboardReport,
  ReportPeriod,
  SalesReportItem,
  SalesReportParams,
  TopProductItem,
  TopProductsParams,
} from '../types/reports';

const EMPTY_DASHBOARD: EmptyDashboardReport = {
  openOrders: 0,
  availableUnits: 0,
  confirmedPayments: 0,
  newOrders: 0,
  preparingOrders: 0,
  billedToday: 0,
  acceptanceRate: 0,
  lowStockProducts: [],
  topProducts: [],
};

export async function getDashboardReport(): Promise<DashboardReport> {
  try {
    return await api<DashboardReport>('/reports/dashboard', { method: 'GET' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { ...EMPTY_DASHBOARD };
    }

    throw error;
  }
}

export async function getSalesReport(params: SalesReportParams = {}) {
  const query = new URLSearchParams();
  if (params.period) {
    query.set('period', params.period);
  }
  if (params.from) {
    query.set('from', params.from);
  }
  if (params.to) {
    query.set('to', params.to);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api<SalesReportItem[]>(`/reports/sales${suffix}`, {
    method: 'GET',
  });
}

export async function getTopProducts(params: TopProductsParams = {}) {
  const query = new URLSearchParams();
  if (params.period) {
    query.set('period', params.period);
  }
  if (typeof params.limit === 'number') {
    query.set('limit', String(params.limit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api<TopProductItem[]>(`/reports/products/top${suffix}`, {
    method: 'GET',
  });
}

export async function getAcceptanceRateReport(period?: ReportPeriod) {
  const suffix = period ? `?period=${encodeURIComponent(period)}` : '';
  return api<AcceptanceRateReport>(`/reports/acceptance-rate${suffix}`, {
    method: 'GET',
  });
}

export async function downloadReportFile(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo de relatorio (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

export async function exportOrders(format: 'xlsx' | 'csv' = 'xlsx') {
  await downloadReportFile(`/reports/orders/export?format=${format}`, `orders-report.${format}`);
}

export async function exportInventory(format: 'xlsx' | 'csv' = 'xlsx') {
  void format;
  throw new Error('Exportacao ainda nao disponivel no backend.');
}

export async function exportDeliveries(format: 'xlsx' | 'csv' = 'xlsx') {
  void format;
  throw new Error('Exportacao ainda nao disponivel no backend.');
}
