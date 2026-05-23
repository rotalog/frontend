import { api, API_URL, ApiError, getAccessToken } from './api';
import type {
  AcceptanceRateReport,
  DashboardReport,
  ExportReportResult,
  SalesReport,
  TopProductReport,
} from '../types/reports';

const EMPTY_DASHBOARD: DashboardReport = {
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

export async function getSalesReport(): Promise<SalesReport> {
  try {
    return await api<SalesReport>('/reports/sales', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        series: [],
      };
    }

    throw error;
  }
}

export async function getTopProductsReport(): Promise<TopProductReport[]> {
  try {
    return await api<TopProductReport[]>('/reports/products/top', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function getAcceptanceRateReport(): Promise<AcceptanceRateReport> {
  try {
    return await api<AcceptanceRateReport>('/reports/acceptance-rate', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        acceptanceRate: 0,
        acceptedOrders: 0,
        rejectedOrders: 0,
        totalOrders: 0,
      };
    }

    throw error;
  }
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, '');
    }
  }

  const filenameMatch = disposition.match(/filename=([^;]+)/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim().replace(/^"|"$/g, '');
  }

  return null;
}

function fallbackFilenameByContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();

  if (normalized.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return 'relatorio-pedidos.xlsx';
  }

  if (normalized.includes('application/vnd.ms-excel')) {
    return 'relatorio-pedidos.xls';
  }

  if (normalized.includes('text/csv') || normalized.includes('application/csv')) {
    return 'relatorio-pedidos.csv';
  }

  return 'relatorio-pedidos.xlsx';
}

async function blobLooksLikeZip(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function exportOrdersReport(): Promise<ExportReportResult> {
  const headers = new Headers({
    Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv, application/csv, */*',
  });

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}/reports/orders/export`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    throw new ApiError(`Falha na exportacao de relatorio (HTTP ${response.status}).`, response.status, errorData);
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type') ?? blob.type ?? '';
  const disposition = response.headers.get('Content-Disposition');

  let filename = parseFilenameFromDisposition(disposition) ?? fallbackFilenameByContentType(contentType);

  if (!disposition && await blobLooksLikeZip(blob)) {
    filename = 'relatorio-pedidos.xlsx';
  }

  return {
    blob,
    filename,
    contentType,
  };
}
