import { useEffect, useMemo, useState } from 'react';
import { Sidebar, type DashboardSection } from '../Components/Sidebar';
import { OrderTable } from '../Components/OrderTable';
import { StockManagementSection } from '../Components/StockManagementSection';
import { KpiCard } from '../Components/KpiCard';
import { NewOrderBanner } from '../Components/NewOrderBanner';
import { mockOrders, mockStock } from '../data/mockData';
import { ApiError } from '../services/api';
import { arriveDeliveryPoint, failDeliveryPoint, sendDeliveryProof } from '../services/deliveryPoints';
import { getInventory } from '../services/inventory';
import { getOrders } from '../services/orders';
import { getSupplierProducts } from '../services/products';
import {
  getAcceptanceRateReport,
  getDashboardReport,
  getSalesReport,
  getTopProductsReport,
} from '../services/reports';
import {
  getProductRatingSummary,
  getProductReviews,
  getSupplierRatingSummary,
  getSupplierReviews,
} from '../services/reviews';
import { completeRoute, generateRoute, getRoutePoints, getRoutes, getTodayRoutes, startRoute } from '../services/routes';
import { getCurrentUser } from '../services/auth';
import type { ApiInventoryItem } from '../types/inventory';
import type { ApiProduct } from '../types/products';
import type { ApiDeliveryPoint, ApiRoute, GenerateRouteStop } from '../types/routes';
import type { Order, OrderStatus, StockMovement } from '../types/orders';
import type { ApiOrder } from '../types/orders';
import type {
  AcceptanceRateReport,
  DashboardReport,
  SalesReport,
  TopProductReport,
} from '../types/reports';
import type { RatingSummaryResponse, ReviewResponse } from '../types/reviews';
import {
  calculateFallbackKpis,
  getNumberValue,
  mapApiInventoryToLegacyStock,
  mapApiOrderToLegacyOrder,
} from '../utils/dashboardMappers';
import { exportOrdersToXlsx } from '../utils/exportOrdersReport';

interface DashboardPageProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onLogout: () => void;
  companyName: string;
}

type OverviewTab = 'VISAO_GERAL' | 'PEDIDOS' | 'ESTOQUE' | 'ENTREGAS' | 'RELATORIOS';

const topNavItems: Array<{ tab: OverviewTab; label: string }> = [
  { tab: 'VISAO_GERAL', label: 'Visão geral' },
  { tab: 'PEDIDOS', label: 'Pedidos' },
  { tab: 'ESTOQUE', label: 'Estoque' },
  { tab: 'ENTREGAS', label: 'Entregas' },
  { tab: 'RELATORIOS', label: 'Relatórios' },
];

type OrderFlowColumn = {
  id: 'PAGO' | 'EM_SEPARACAO' | 'DESPACHADO' | 'ENTREGUE';
  title: string;
  icon: string;
  statuses: OrderStatus[];
  action?: {
    label: string;
    nextStatus: OrderStatus;
    className: string;
  };
};

type DashboardStockRow = {
  product: string;
  available: number;
  reserved: number;
};

const EMPTY_RATING_SUMMARY: RatingSummaryResponse = {
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: {},
};

function mapProductAndInventoryToStock(products: ApiProduct[], inventory: ApiInventoryItem[]) {
  const inventoryByProductId = new Map<string, ApiInventoryItem>();
  for (const item of inventory) {
    if (typeof item.productId === 'string' && item.productId.trim()) {
      inventoryByProductId.set(item.productId, item);
    }
  }

  const merged = products.map(product => {
    const inventoryItem = inventoryByProductId.get(product.id);
    const totalQuantity = inventoryItem
      ? (typeof inventoryItem.totalQuantity === 'number'
        ? inventoryItem.totalQuantity
        : 0)
      : 0;
    const reservedQuantity = inventoryItem
      ? (typeof inventoryItem.reservedQuantity === 'number' ? inventoryItem.reservedQuantity : 0)
      : 0;
    const availableQuantity = inventoryItem
      ? (typeof inventoryItem.availableQuantity === 'number'
        ? inventoryItem.availableQuantity
        : Math.max(0, totalQuantity - reservedQuantity))
      : 0;

    return {
      id: product.id,
      productId: product.id,
      supplierId: product.supplierId,
      codigo: product.id,
      name: product.name,
      produto: product.name,
      minStockLevel: product.minStockLevel,
      imageUrl: product.imageUrl,
      fotoUrl: product.imageUrl,
      total: totalQuantity,
      reservado: reservedQuantity,
      totalQuantity,
      reservedQuantity,
      availableQuantity,
      badges: [],
    };
  });

  // Keep inventory-only rows visible if backend inventory has orphan items not present in /suppliers/{id}/products.
  const mergedIds = new Set(merged.map(item => item.productId));
  const inventoryOnly = inventory
    .filter(item => typeof item.productId === 'string' && !mergedIds.has(item.productId))
    .map(item => mapApiInventoryToLegacyStock(item));

  return [...merged, ...inventoryOnly];
}

const orderFlowColumns: OrderFlowColumn[] = [
  {
    id: 'PAGO',
    title: 'Pago',
    icon: '≡',
    statuses: ['PAGAMENTO_CONFIRMADO', 'ACEITO'],
    action: {
      label: 'Iniciar preparo',
      nextStatus: 'EM_SEPARACAO',
      className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 light:bg-emerald-100 light:text-emerald-700',
    },
  },
  {
    id: 'EM_SEPARACAO',
    title: 'Em separação',
    icon: '📦',
    statuses: ['EM_SEPARACAO'],
    action: {
      label: 'Despachar',
      nextStatus: 'SAIU_PARA_ENTREGA',
      className: 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 light:bg-sky-100 light:text-sky-700',
    },
  },
  {
    id: 'DESPACHADO',
    title: 'Despachado',
    icon: '🚚',
    statuses: ['SAIU_PARA_ENTREGA'],
    action: {
      label: 'Marcar entregue',
      nextStatus: 'ENTREGUE',
      className: 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 light:bg-violet-100 light:text-violet-700',
    },
  },
  {
    id: 'ENTREGUE',
    title: 'Entregue',
    icon: '✅',
    statuses: ['ENTREGUE'],
  },
];

const flowTimeByStatus: Partial<Record<OrderStatus, string>> = {
  ACEITO: 'Pago às 08:45',
  PAGAMENTO_CONFIRMADO: 'Pago às 09:05',
  EM_SEPARACAO: 'Iniciado 08:50',
  SAIU_PARA_ENTREGA: 'Saiu às 07:30',
  ENTREGUE: 'Entregue 07:55',
};

function isValidApiId(id?: string): boolean {
  return typeof id === 'string' && id.length >= 20 && !id.startsWith('mock-');
}

function getRouteStatusLabel(status?: string): string {
  if (!status) {
    return 'Planejada';
  }

  const normalized = status.toUpperCase();
  const map: Record<string, string> = {
    PLANNED: 'Planejada',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };

  return map[normalized] ?? status;
}

function getDeliveryPointStatusLabel(status?: string): string {
  if (!status) {
    return 'Pendente';
  }

  const normalized = status.toUpperCase();
  const map: Record<string, string> = {
    PENDING: 'Pendente',
    ARRIVED: 'Chegada registrada',
    DELIVERED: 'Entregue',
    FAILED: 'Falha na entrega',
  };

  return map[normalized] ?? status;
}

export function DashboardPage({ theme, toggleTheme, onLogout, companyName }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('VISAO_GERAL');
  const [activeOverviewTab, setActiveOverviewTab] = useState<OverviewTab>('VISAO_GERAL');
  const [overviewOrders, setOverviewOrders] = useState<Order[]>(mockOrders);
  const [stockNotice, setStockNotice] = useState('Novo pedido recebido - Mercado Central');
  const [stock, setStock] = useState(mockStock);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardReport, setDashboardReport] = useState<DashboardReport | null>(null);
  const [apiOrders, setApiOrders] = useState<ApiOrder[]>([]);
  const [apiInventory, setApiInventory] = useState<ApiInventoryItem[]>([]);
  const [todayRoute, setTodayRoute] = useState<ApiRoute[]>([]);
  const [selectedDriverId] = useState('');
  const [routeHistory, setRouteHistory] = useState<ApiRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedRoutePoints, setSelectedRoutePoints] = useState<ApiDeliveryPoint[]>([]);
  const [isSyncingRouteAction, setIsSyncingRouteAction] = useState('');
  const [routeActionFeedback, setRouteActionFeedback] = useState('');
  const [routeActionError, setRouteActionError] = useState('');
  const [usingMockFallback, setUsingMockFallback] = useState(false);
  const [inventoryNotInitialized, setInventoryNotInitialized] = useState(false);
  const [apiWarning, setApiWarning] = useState('');
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportsWarning, setReportsWarning] = useState('');
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [topProductsReport, setTopProductsReport] = useState<TopProductReport[]>([]);
  const [acceptanceRateReport, setAcceptanceRateReport] = useState<AcceptanceRateReport | null>(null);
  const [isExportingOrdersReport, setIsExportingOrdersReport] = useState(false);
  const [reportExportMessage, setReportExportMessage] = useState('');
  const [reportExportError, setReportExportError] = useState('');
  const [hasLoadedReports, setHasLoadedReports] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [isLoadingSupplierReviews, setIsLoadingSupplierReviews] = useState(false);
  const [supplierReviewsError, setSupplierReviewsError] = useState('');
  const [supplierReviews, setSupplierReviews] = useState<ReviewResponse[]>([]);
  const [supplierRatingSummary, setSupplierRatingSummary] = useState<RatingSummaryResponse>(EMPTY_RATING_SUMMARY);
  const [hasLoadedSupplierReviews, setHasLoadedSupplierReviews] = useState(false);
  const [isLoadingHighlightedProductReviews, setIsLoadingHighlightedProductReviews] = useState(false);
  const [highlightedProductReviewsError, setHighlightedProductReviewsError] = useState('');
  const [highlightedProductReviews, setHighlightedProductReviews] = useState<ReviewResponse[]>([]);
  const [highlightedProductRatingSummary, setHighlightedProductRatingSummary] = useState<RatingSummaryResponse>(EMPTY_RATING_SUMMARY);

  // Raw API responses — consumed by derived state below and available for future tabs.
  const hasApiData = useMemo(
    () => apiOrders.length > 0 || apiInventory.length > 0 || Boolean(dashboardReport) || todayRoute.length > 0 || routeHistory.length > 0,
    [apiOrders, apiInventory, dashboardReport, todayRoute, routeHistory],
  );
  void hasApiData;

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      setIsLoadingDashboard(true);
      setDashboardError('');
      setApiWarning('');
      setInventoryNotInitialized(false);

      const [reportResult, ordersResult, inventoryResult, todayRouteResult, routeHistoryResult, currentUserResult] = await Promise.allSettled([
        getDashboardReport(),
        getOrders(),
        getInventory(),
        getTodayRoutes(),
        getRoutes(),
        getCurrentUser(),
      ]);

      const currentSupplierId = currentUserResult.status === 'fulfilled' ? currentUserResult.value.supplierId : undefined;
      const productsResult = currentSupplierId
        ? await Promise.allSettled([getSupplierProducts(currentSupplierId)]).then(results => results[0])
        : await Promise.resolve({ status: 'fulfilled', value: [] } as PromiseFulfilledResult<ApiProduct[]>);

      if (!active) {
        return;
      }

      setSupplierId(typeof currentSupplierId === 'string' ? currentSupplierId : '');

      let hasSuccess = false;
      let hasMockFallback = false;

      if (reportResult.status === 'fulfilled') {
        setDashboardReport(reportResult.value);
        hasSuccess = true;
      } else {
        setDashboardReport(null);
      }

      if (ordersResult.status === 'fulfilled') {
        setApiOrders(ordersResult.value);
        setOverviewOrders(ordersResult.value.map(mapApiOrderToLegacyOrder));
        hasSuccess = true;
      } else {
        setApiOrders([]);
        setOverviewOrders(mockOrders);
        setApiWarning('Exibindo dados demonstrativos.');
        hasMockFallback = true;
        hasSuccess = true;
      }

      if (inventoryResult.status === 'fulfilled') {
        setApiInventory(inventoryResult.value);
        if (productsResult.status === 'fulfilled') {
          setStock(mapProductAndInventoryToStock(productsResult.value, inventoryResult.value));
          if (productsResult.value.length > 0 && inventoryResult.value.length === 0) {
            setApiWarning('Produtos carregados. Estoque ainda não inicializado para alguns itens.');
            setInventoryNotInitialized(true);
          }
        } else {
          setStock(inventoryResult.value.map(mapApiInventoryToLegacyStock));
        }
        hasSuccess = true;
      } else {
        setApiInventory([]);
        if (productsResult.status === 'fulfilled') {
          setStock(mapProductAndInventoryToStock(productsResult.value, []));
          setInventoryNotInitialized(productsResult.value.length > 0);
          hasSuccess = hasSuccess || productsResult.value.length > 0;
        } else {
          setStock([]);
          setInventoryNotInitialized(true);
        }
      }

      if (todayRouteResult.status === 'fulfilled') {
        setTodayRoute(todayRouteResult.value);
        if (!selectedRouteId && todayRouteResult.value[0]?.id) {
          setSelectedRouteId(todayRouteResult.value[0].id);
        }
        hasSuccess = true;
      } else {
        setTodayRoute([]);
      }

      if (routeHistoryResult.status === 'fulfilled') {
        setRouteHistory(routeHistoryResult.value);
        if (!selectedRouteId && routeHistoryResult.value[0]?.id) {
          setSelectedRouteId(routeHistoryResult.value[0].id);
        }
        hasSuccess = true;
      } else {
        setRouteHistory([]);
      }

      const hasPartialError = [reportResult, ordersResult, inventoryResult, todayRouteResult, routeHistoryResult, productsResult]
        .some(result => result.status === 'rejected');

      if (!hasSuccess) {
        hasMockFallback = false;
      }

      if (!hasSuccess) {
        setDashboardError('Não foi possível carregar os dados do painel.');
      } else if (hasPartialError && !hasMockFallback) {
        setApiWarning('Algumas informações ainda não estão disponíveis.');
      }

      setUsingMockFallback(hasMockFallback);
      setIsLoadingDashboard(false);
    };

    void loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!usingMockFallback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const realtimeOrder: Order = {
        id: 'PED-1130',
        cliente: 'Mercado Central',
        valorTotal: 735.5,
        status: 'PAGAMENTO_CONFIRMADO',
        dataDesejada: '2026-05-15',
        itens: [
          { nome: 'Arroz 5kg', quantidade: 10, preco: 26.9 },
          { nome: 'Feijao 1kg', quantidade: 25, preco: 8.5 },
        ],
      };

      setOverviewOrders(current => (
        current.some(order => order.id === realtimeOrder.id) ? current : [realtimeOrder, ...current]
      ));
      setStockNotice(`Novo pedido recebido - ${realtimeOrder.cliente}`);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [usingMockFallback]);

  const headerTitle = useMemo(() => {
    switch (activeSection) {
      case 'PEDIDOS':
        return 'Gestão de Pedidos';
      case 'ESTOQUE':
        return 'Controle de Estoque';
      case 'ENTREGAS':
        return 'Entregas do Dia';
      case 'RELATORIOS':
        return 'Relatórios';
      case 'CONFIGURACOES':
        return 'Configurações';
      default:
        return 'Dashboard do Fornecedor';
    }
  }, [activeSection]);

  const activeOverviewLabel = useMemo(() => {
    return topNavItems.find(item => item.tab === activeOverviewTab)?.label ?? 'Visão geral';
  }, [activeOverviewTab]);

  const fallbackKpis = useMemo(() => {
    return calculateFallbackKpis(overviewOrders, stock);
  }, [overviewOrders, stock]);

  const dashboardKpis = useMemo(() => {
    const source = dashboardReport as Record<string, unknown> | null;
    const revenueToday = getNumberValue(source, ['billedToday', 'totalRevenue', 'faturamentoTotal', 'revenueToday'], fallbackKpis.revenueToday);
    const totalOrders = getNumberValue(source, ['openOrders', 'totalOrders', 'pedidosTotal'], fallbackKpis.totalOrders);
    const pendingOrders = getNumberValue(source, ['newOrders', 'pendingOrders', 'pedidosPendentes'], fallbackKpis.pendingOrders);
    const preparingOrders = getNumberValue(source, ['preparingOrders', 'pedidosEmSeparacao'], fallbackKpis.preparingOrders);
    const acceptanceRate = getNumberValue(source, ['acceptanceRate', 'taxaAceite'], fallbackKpis.acceptanceRate);
    const lowStockCount = getNumberValue(source, ['lowStockCount', 'estoqueBaixo'], fallbackKpis.lowStockCount);
    const availableUnits = getNumberValue(source, ['availableUnits'], fallbackKpis.totalOrders);
    const confirmedPayments = getNumberValue(source, ['confirmedPayments'], 0);
    void availableUnits;
    void confirmedPayments;

    const rawTopProducts = source?.topProducts;
    const mappedTopProducts = Array.isArray(rawTopProducts)
      ? rawTopProducts.map(item => {
        const product = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
        return {
          name: String(product.name ?? product.productName ?? product.nome ?? 'Produto'),
          percent: getNumberValue(product, ['percent', 'percentage', 'share'], 0),
        };
      })
      : fallbackKpis.topProducts;

    return {
      revenueToday,
      totalOrders,
      pendingOrders,
      preparingOrders,
      acceptanceRate,
      lowStockCount,
      monthlyOrders: totalOrders,
      deliveriesInProgress: fallbackKpis.deliveriesInProgress,
      topProducts: mappedTopProducts.length > 0 ? mappedTopProducts : fallbackKpis.topProducts,
    };
  }, [dashboardReport, fallbackKpis]);

  const isReportsView = activeOverviewTab === 'RELATORIOS' || activeSection === 'RELATORIOS';

  const salesRevenue = useMemo(() => {
    const raw = Number(salesReport?.totalRevenue ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [salesReport]);

  const salesOrders = useMemo(() => {
    const raw = Number(salesReport?.totalOrders ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [salesReport]);

  const acceptanceRateValue = useMemo(() => {
    const raw = Number(acceptanceRateReport?.acceptanceRate ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [acceptanceRateReport]);

  const mappedTopProducts = useMemo(() => {
    const normalized = topProductsReport.map((item, index) => {
      const label = String(item.productName ?? item.name ?? `Produto ${index + 1}`);
      const quantity = Number(item.quantitySold ?? 0);
      const revenue = Number(item.totalRevenue ?? 0);

      return {
        key: `${label}-${index}`,
        label,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        revenue: Number.isFinite(revenue) ? revenue : 0,
      };
    });

    const maxQuantity = normalized.reduce((max, current) => Math.max(max, current.quantity), 0);

    return normalized.map(item => ({
      ...item,
      percent: maxQuantity > 0 ? Math.max(8, Math.round((item.quantity / maxQuantity) * 100)) : 0,
    }));
  }, [topProductsReport]);

  const hasSalesData = salesRevenue > 0 || salesOrders > 0 || Array.isArray(salesReport?.series) && salesReport.series.length > 0;
  const hasTopProductsData = mappedTopProducts.length > 0;
  const hasAcceptanceDetails = Number(acceptanceRateReport?.totalOrders ?? 0) > 0;

  const deliveriesToday = useMemo(() => {
    return overviewOrders.filter(order => order.status === 'SAIU_PARA_ENTREGA' || order.status === 'ENTREGUE');
  }, [overviewOrders]);

  useEffect(() => {
    if (!isReportsView || hasLoadedReports) {
      return;
    }

    let active = true;

    const loadReportsData = async () => {
      setIsLoadingReports(true);
      setReportsError('');
      setReportsWarning('');

      const [salesResult, topProductsResult, acceptanceResult] = await Promise.allSettled([
        getSalesReport(),
        getTopProductsReport(),
        getAcceptanceRateReport(),
      ]);

      if (!active) {
        return;
      }

      let successCount = 0;

      if (salesResult.status === 'fulfilled') {
        setSalesReport(salesResult.value);
        successCount += 1;
      } else {
        setSalesReport(null);
      }

      if (topProductsResult.status === 'fulfilled') {
        setTopProductsReport(topProductsResult.value);
        successCount += 1;
      } else {
        setTopProductsReport([]);
      }

      if (acceptanceResult.status === 'fulfilled') {
        setAcceptanceRateReport(acceptanceResult.value);
        successCount += 1;
      } else {
        setAcceptanceRateReport(null);
      }

      if (successCount === 0) {
        setReportsError('Não foi possível carregar os relatórios.');
      } else if (successCount < 3) {
        setReportsWarning('Algumas informações de relatório ainda não estão disponíveis.');
      }

      setHasLoadedReports(true);
      setIsLoadingReports(false);
    };

    void loadReportsData();

    return () => {
      active = false;
    };
  }, [hasLoadedReports, isReportsView]);

  const highlightedProductId = useMemo(() => {
    const firstInventoryItem = apiInventory.find(item => isValidApiId(item.productId));
    return firstInventoryItem?.productId ?? '';
  }, [apiInventory]);

  const getReviewsErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.status === 403) {
        return 'Você não tem permissão para acessar avaliações.';
      }

      if (error.status >= 500) {
        return 'Erro interno ao carregar avaliações.';
      }

      if (error.status === 404) {
        return 'Nenhuma avaliação encontrada.';
      }
    }

    return 'Não foi possível carregar as avaliações.';
  };

  useEffect(() => {
    if (!isReportsView || hasLoadedSupplierReviews) {
      return;
    }

    let active = true;

    const loadSupplierReviews = async () => {
      setIsLoadingSupplierReviews(true);
      setSupplierReviewsError('');

      if (!isValidApiId(supplierId)) {
        if (!active) {
          return;
        }

        setSupplierReviews([]);
        setSupplierRatingSummary(EMPTY_RATING_SUMMARY);
        setHasLoadedSupplierReviews(true);
        setIsLoadingSupplierReviews(false);
        return;
      }

      const [reviewsResult, summaryResult] = await Promise.allSettled([
        getSupplierReviews(supplierId),
        getSupplierRatingSummary(supplierId),
      ]);

      if (!active) {
        return;
      }

      if (reviewsResult.status === 'fulfilled') {
        setSupplierReviews(reviewsResult.value);
      } else {
        setSupplierReviews([]);
      }

      if (summaryResult.status === 'fulfilled') {
        setSupplierRatingSummary(summaryResult.value);
      } else {
        setSupplierRatingSummary(EMPTY_RATING_SUMMARY);
      }

      if (reviewsResult.status === 'rejected' && summaryResult.status === 'rejected') {
        setSupplierReviewsError(getReviewsErrorMessage(reviewsResult.reason));
      }

      setHasLoadedSupplierReviews(true);
      setIsLoadingSupplierReviews(false);
    };

    void loadSupplierReviews();

    return () => {
      active = false;
    };
  }, [hasLoadedSupplierReviews, isReportsView, supplierId]);

  useEffect(() => {
    if (!isReportsView) {
      return;
    }

    let active = true;

    const loadHighlightedProductReviews = async () => {
      setIsLoadingHighlightedProductReviews(true);
      setHighlightedProductReviewsError('');

      if (!isValidApiId(highlightedProductId)) {
        if (!active) {
          return;
        }

        setHighlightedProductReviews([]);
        setHighlightedProductRatingSummary(EMPTY_RATING_SUMMARY);
        setIsLoadingHighlightedProductReviews(false);
        return;
      }

      const [reviewsResult, summaryResult] = await Promise.allSettled([
        getProductReviews(highlightedProductId),
        getProductRatingSummary(highlightedProductId),
      ]);

      if (!active) {
        return;
      }

      if (reviewsResult.status === 'fulfilled') {
        setHighlightedProductReviews(reviewsResult.value);
      } else {
        setHighlightedProductReviews([]);
      }

      if (summaryResult.status === 'fulfilled') {
        setHighlightedProductRatingSummary(summaryResult.value);
      } else {
        setHighlightedProductRatingSummary(EMPTY_RATING_SUMMARY);
      }

      if (reviewsResult.status === 'rejected' && summaryResult.status === 'rejected') {
        setHighlightedProductReviewsError(getReviewsErrorMessage(reviewsResult.reason));
      }

      setIsLoadingHighlightedProductReviews(false);
    };

    void loadHighlightedProductReviews();

    return () => {
      active = false;
    };
  }, [highlightedProductId, isReportsView]);

  useEffect(() => {
    setHasLoadedSupplierReviews(false);
  }, [supplierId]);

  const handleExportOrdersReport = async () => {
    setIsExportingOrdersReport(true);
    setReportExportError('');
    setReportExportMessage('');

    try {
      exportOrdersToXlsx(apiOrders);

      setReportExportMessage(
        apiOrders.length === 0
          ? 'Relatório vazio exportado com sucesso.'
          : 'Relatório de pedidos exportado com sucesso.',
      );
    } catch (error) {
      void error;
      setReportExportError('Não foi possível exportar o relatório de pedidos.');
    } finally {
      setIsExportingOrdersReport(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatReviewDate = (rawDate?: string): string => {
    if (!rawDate) {
      return 'Data não informada';
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'Data não informada';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsed);
  };

  const recentSupplierReviews = useMemo(() => {
    return [...supplierReviews]
      .sort((a, b) => {
        const aTime = new Date(String(a.createdAt ?? '')).getTime();
        const bTime = new Date(String(b.createdAt ?? '')).getTime();
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [supplierReviews]);

  const recentHighlightedProductReviews = useMemo(() => {
    return [...highlightedProductReviews]
      .sort((a, b) => {
        const aTime = new Date(String(a.createdAt ?? '')).getTime();
        const bTime = new Date(String(b.createdAt ?? '')).getTime();
        return bTime - aTime;
      })
      .slice(0, 2);
  }, [highlightedProductReviews]);

  const supplierAverageRating = Number(supplierRatingSummary.averageRating ?? 0);
  const supplierTotalReviews = Number(supplierRatingSummary.totalReviews ?? supplierReviews.length);
  const highlightedProductAverageRating = Number(highlightedProductRatingSummary.averageRating ?? 0);
  const highlightedProductTotalReviews = Number(highlightedProductRatingSummary.totalReviews ?? highlightedProductReviews.length);

  const renderReviewsInsights = () => {
    return (
      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-lg border border-[#222222] bg-[#181818] p-5 light:border-gray-200 light:bg-gray-50">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white dark:text-white light:text-gray-900">Avaliação do fornecedor</h3>
              <p className="mt-1 text-xs text-gray-500 light:text-gray-600">Média atual e comentários recentes</p>
            </div>
            <span className="rounded-full bg-[#00ff66]/15 px-3 py-1 text-xs font-semibold text-[#00ff66] light:bg-green-100 light:text-green-700">
              {supplierAverageRating.toFixed(1)} / 5
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500 light:text-gray-600">Total de avaliações: {supplierTotalReviews}</p>

          {isLoadingSupplierReviews && (
            <p className="text-xs text-gray-500 light:text-gray-600">Carregando avaliações...</p>
          )}

          {!isLoadingSupplierReviews && supplierReviewsError && (
            <p className="text-xs text-amber-300 light:text-amber-700">{supplierReviewsError}</p>
          )}

          {!isLoadingSupplierReviews && !supplierReviewsError && recentSupplierReviews.length === 0 && (
            <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma avaliação recebida ainda.</p>
          )}

          {!isLoadingSupplierReviews && !supplierReviewsError && recentSupplierReviews.length > 0 && (
            <div className="space-y-3">
              {recentSupplierReviews.map(review => (
                <div key={review.id} className="rounded-md border border-[#262626] bg-[#121212] p-3 light:border-gray-200 light:bg-white">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-300 light:text-amber-700">
                      Nota {Number(review.rating ?? 0).toFixed(1)} / 5
                    </span>
                    <span className="text-[11px] text-gray-500 light:text-gray-600">{formatReviewDate(typeof review.createdAt === 'string' ? review.createdAt : undefined)}</span>
                  </div>
                  <p className="text-sm text-gray-300 light:text-gray-700">
                    {typeof review.comment === 'string' && review.comment.trim() ? review.comment : 'Sem comentário.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#222222] bg-[#181818] p-5 light:border-gray-200 light:bg-gray-50">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white dark:text-white light:text-gray-900">Avaliação de produto em destaque</h3>
              <p className="mt-1 text-xs text-gray-500 light:text-gray-600">Resumo do primeiro produto com estoque disponível</p>
            </div>
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 light:bg-sky-100 light:text-sky-700">
              {highlightedProductAverageRating.toFixed(1)} / 5
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500 light:text-gray-600">Total de avaliações: {highlightedProductTotalReviews}</p>

          {isLoadingHighlightedProductReviews && (
            <p className="text-xs text-gray-500 light:text-gray-600">Carregando avaliações do produto...</p>
          )}

          {!isLoadingHighlightedProductReviews && highlightedProductReviewsError && (
            <p className="text-xs text-amber-300 light:text-amber-700">{highlightedProductReviewsError}</p>
          )}

          {!isLoadingHighlightedProductReviews && !highlightedProductReviewsError && recentHighlightedProductReviews.length === 0 && (
            <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma avaliação encontrada.</p>
          )}

          {!isLoadingHighlightedProductReviews && !highlightedProductReviewsError && recentHighlightedProductReviews.length > 0 && (
            <div className="space-y-3">
              {recentHighlightedProductReviews.map(review => (
                <div key={review.id} className="rounded-md border border-[#262626] bg-[#121212] p-3 light:border-gray-200 light:bg-white">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-300 light:text-amber-700">
                      Nota {Number(review.rating ?? 0).toFixed(1)} / 5
                    </span>
                    <span className="text-[11px] text-gray-500 light:text-gray-600">{formatReviewDate(typeof review.createdAt === 'string' ? review.createdAt : undefined)}</span>
                  </div>
                  <p className="text-sm text-gray-300 light:text-gray-700">
                    {typeof review.comment === 'string' && review.comment.trim() ? review.comment : 'Sem comentário.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const registerStockMovements = (newMovements: Array<Omit<StockMovement, 'id' | 'createdAt'>>) => {
    if (newMovements.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const normalized = newMovements.map((movement, index) => ({
      ...movement,
      id: `${Date.now()}-${index}-${movement.product}`,
      createdAt,
    }));

    setStockMovements(current => [...normalized, ...current]);
  };

  const visibleFlowOrders = useMemo(() => {
    return overviewOrders.filter(order => !['SOLICITADO', 'PENDENTE', 'RECUSADO', 'REJEITADO', 'CANCELADO'].includes(order.status));
  }, [overviewOrders]);

  const flowOrdersByColumn = useMemo(() => {
    return orderFlowColumns.reduce<Record<OrderFlowColumn['id'], Order[]>>((acc, column) => {
      acc[column.id] = visibleFlowOrders.filter(order => column.statuses.includes(order.status));
      return acc;
    }, {
      PAGO: [],
      EM_SEPARACAO: [],
      DESPACHADO: [],
      ENTREGUE: [],
    });
  }, [visibleFlowOrders]);

  const preparingOrders = useMemo(() => {
    return overviewOrders.filter(order => order.status === 'EM_SEPARACAO');
  }, [overviewOrders]);

  const dispatchOrder = preparingOrders[0];

  const dashboardStockRows = useMemo<DashboardStockRow[]>(() => {
    const reservedByProduct = preparingOrders.reduce<Record<string, number>>((acc, order) => {
      order.itens.forEach(item => {
        acc[item.nome] = (acc[item.nome] ?? 0) + item.quantidade;
      });
      return acc;
    }, {});

    return stock.slice(0, 6).map(item => ({
      product: item.produto,
      available: item.total,
      reserved: reservedByProduct[item.produto] ?? item.reservado,
    }));
  }, [preparingOrders, stock]);

  const updateOverviewOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    setOverviewOrders(current => current.map(order => (
      order.id === orderId ? { ...order, status: nextStatus } : order
    )));
  };

  const confirmDispatchOrder = (order: Order) => {
    setOverviewOrders(current => current.map(currentOrder => (
      currentOrder.id === order.id ? { ...currentOrder, status: 'SAIU_PARA_ENTREGA' } : currentOrder
    )));

    setStock(current => current.map(stockItem => {
      const orderItem = order.itens.find(item => item.nome === stockItem.produto);

      if (!orderItem) {
        return stockItem;
      }

      return {
        ...stockItem,
        total: Math.max(0, stockItem.total - orderItem.quantidade),
        reservado: Math.max(0, stockItem.reservado - orderItem.quantidade),
      };
    }));

    setStockNotice(`Pedido ${order.id} confirmado para despacho`);
  };

  const getOrderDistance = (order: Order) => {
    const distance = (order.valorTotal / 1000).toFixed(1).replace('.', ',');
    return `${distance} km`;
  };

  const getDeliveryStatus = (status: OrderStatus) => {
    if (status === 'ENTREGUE') {
      return 'Entregue';
    }

    if (status === 'SAIU_PARA_ENTREGA') {
      return 'A caminho';
    }

    return 'Pendente';
  };

  const getDeliveryStatusClass = (status: OrderStatus) => {
    if (status === 'ENTREGUE') {
      return 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700';
    }

    if (status === 'SAIU_PARA_ENTREGA') {
      return 'bg-sky-500/15 text-sky-300 light:bg-sky-100 light:text-sky-700';
    }

    return 'bg-[#202020] text-gray-400 light:bg-gray-100 light:text-gray-600';
  };

  const deliveryOrders = useMemo(() => {
    return overviewOrders.filter(order => (
      order.status === 'EM_SEPARACAO' ||
      order.status === 'SAIU_PARA_ENTREGA' ||
      order.status === 'ENTREGUE'
    ));
  }, [overviewOrders]);

  const routeGenerationContext = useMemo(() => {
    const stops: GenerateRouteStop[] = [];
    let missingCoordinatesCount = 0;

    for (const order of deliveryOrders) {
      const source = order as unknown as Record<string, unknown>;
      const latitudeCandidate = source.latitude ?? source.lat ?? source.deliveryLatitude;
      const longitudeCandidate = source.longitude ?? source.lng ?? source.deliveryLongitude;
      const latitude = typeof latitudeCandidate === 'number' ? latitudeCandidate : Number(latitudeCandidate);
      const longitude = typeof longitudeCandidate === 'number' ? longitudeCandidate : Number(longitudeCandidate);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isValidApiId(order.id)) {
        missingCoordinatesCount += 1;
        continue;
      }

      stops.push({
        orderId: order.id,
        latitude,
        longitude,
      });
    }

    return {
      stops,
      missingCoordinatesCount,
    };
  }, [deliveryOrders]);

  const canGenerateRoute = selectedDriverId.trim().length > 0 && routeGenerationContext.stops.length > 0;

  const completedDeliveries = useMemo(() => {
    return deliveryOrders.filter(order => order.status === 'ENTREGUE').length;
  }, [deliveryOrders]);

  const refreshRoutesData = async () => {
    const [todayRoutesResult, routesResult] = await Promise.allSettled([
      getTodayRoutes(),
      getRoutes(),
    ]);

    if (todayRoutesResult.status === 'fulfilled') {
      setTodayRoute(todayRoutesResult.value);
      if (!selectedRouteId && todayRoutesResult.value[0]?.id) {
        setSelectedRouteId(todayRoutesResult.value[0].id);
      }
    }

    if (routesResult.status === 'fulfilled') {
      setRouteHistory(routesResult.value);
      if (!selectedRouteId && routesResult.value[0]?.id) {
        setSelectedRouteId(routesResult.value[0].id);
      }
    }
  };

  const setRouteErrorFromApi = (error: unknown) => {
    if (error instanceof ApiError && error.status === 403) {
      setRouteActionError('Você não tem permissão para executar esta ação.');
      return;
    }

    if (error instanceof ApiError && error.status === 404) {
      setRouteActionError('Registro não encontrado no backend.');
      return;
    }

    if (error instanceof ApiError && error.status === 409) {
      setRouteActionError('Esta ação não pode ser executada no status atual.');
      return;
    }

    if (error instanceof ApiError && error.status >= 500) {
      setRouteActionError('Erro interno ao atualizar rota/entrega. Tente novamente em instantes.');
      return;
    }

    setRouteActionError('Erro ao executar ação de rota/entrega.');
  };

  const handleGenerateRoute = async () => {
    if (!canGenerateRoute) {
      setRouteActionError('Para gerar uma rota, selecione um entregador e ao menos uma entrega com localização.');
      return;
    }

    setIsSyncingRouteAction('generate');
    setRouteActionError('');

    try {
      const createdRoute = await generateRoute({
        driverId: selectedDriverId,
        stops: routeGenerationContext.stops,
      });
      setRouteActionFeedback('Rota gerada com sucesso.');
      setTodayRoute(current => [createdRoute, ...current.filter(route => route.id !== createdRoute.id)]);
      setRouteHistory(current => [createdRoute, ...current.filter(route => route.id !== createdRoute.id)]);
      setSelectedRouteId(createdRoute.id);
      await refreshRoutesData();
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  const handleStartRoute = async (routeId?: string) => {
    if (!isValidApiId(routeId)) {
      setRouteActionError('Registro sem ID real: ação simulada localmente.');
      return;
    }

    const validRouteId = routeId as string;

    setIsSyncingRouteAction(`start:${validRouteId}`);
    setRouteActionError('');

    try {
      const updatedRoute = await startRoute(validRouteId);
      setRouteActionFeedback('Rota iniciada com sucesso.');
      setTodayRoute(current => current.map(route => route.id === validRouteId ? { ...route, ...updatedRoute } : route));
      setRouteHistory(current => current.map(route => route.id === validRouteId ? { ...route, ...updatedRoute } : route));
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  const handleCompleteRoute = async (routeId?: string) => {
    if (!isValidApiId(routeId)) {
      setRouteActionError('Registro sem ID real: ação simulada localmente.');
      return;
    }

    const validRouteId = routeId as string;

    setIsSyncingRouteAction(`complete:${validRouteId}`);
    setRouteActionError('');

    try {
      const updatedRoute = await completeRoute(validRouteId);
      setRouteActionFeedback('Rota concluída com sucesso.');
      setTodayRoute(current => current.map(route => route.id === validRouteId ? { ...route, ...updatedRoute } : route));
      setRouteHistory(current => current.map(route => route.id === validRouteId ? { ...route, ...updatedRoute } : route));
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  const handleArrivePoint = async (pointId?: string) => {
    if (!isValidApiId(pointId)) {
      setRouteActionError('Registro sem ID real: ação simulada localmente.');
      return;
    }

    const validPointId = pointId as string;

    setIsSyncingRouteAction(`arrive:${validPointId}`);
    setRouteActionError('');

    try {
      const updatedPoint = await arriveDeliveryPoint(validPointId, {});
      setSelectedRoutePoints(current => current.map(point => point.id === validPointId ? { ...point, ...updatedPoint } : point));
      setRouteActionFeedback('Chegada registrada com sucesso.');
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  const handleSendProof = async (pointId?: string) => {
    if (!isValidApiId(pointId)) {
      setRouteActionError('Registro sem ID real: ação simulada localmente.');
      return;
    }

    const validPointId = pointId as string;

    setIsSyncingRouteAction(`proof:${validPointId}`);
    setRouteActionError('');

    try {
      const updatedPoint = await sendDeliveryProof(validPointId, { proof: 'Entrega confirmada no painel web' });
      setSelectedRoutePoints(current => current.map(point => point.id === validPointId ? { ...point, ...updatedPoint } : point));
      setRouteActionFeedback('Prova de entrega enviada com sucesso.');
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  const handleFailPoint = async (pointId?: string) => {
    if (!isValidApiId(pointId)) {
      setRouteActionError('Registro sem ID real: ação simulada localmente.');
      return;
    }

    const validPointId = pointId as string;

    setIsSyncingRouteAction(`fail:${validPointId}`);
    setRouteActionError('');

    try {
      const updatedPoint = await failDeliveryPoint(validPointId, { reason: 'Falha registrada no painel web' });
      setSelectedRoutePoints(current => current.map(point => point.id === validPointId ? { ...point, ...updatedPoint } : point));
      setRouteActionFeedback('Falha de entrega registrada com sucesso.');
    } catch (error) {
      setRouteErrorFromApi(error);
    } finally {
      setIsSyncingRouteAction('');
    }
  };

  useEffect(() => {
    if (!selectedRouteId || !isValidApiId(selectedRouteId)) {
      setSelectedRoutePoints([]);
      return;
    }

    let active = true;

    const loadRoutePoints = async () => {
      try {
        const points = await getRoutePoints(selectedRouteId);
        if (!active) {
          return;
        }

        setSelectedRoutePoints(points);
      } catch {
        if (!active) {
          return;
        }

        setSelectedRoutePoints([]);
      }
    };

    void loadRoutePoints();

    return () => {
      active = false;
    };
  }, [selectedRouteId]);

  const renderOverviewContent = () => {
    if (activeOverviewTab === 'PEDIDOS') {
      return (
        <section className="rounded-md border border-[#222222] light:border-gray-200 bg-[#151515] dark:bg-[#151515] light:bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#222222] light:border-gray-200 pb-4">
            <div>
              <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Fluxo de pedidos - hoje</h2>
              <p className="mt-1 text-xs !text-white dark:!text-white light:!text-gray-600">Acompanhe e avance os pedidos do dashboard em tempo real.</p>
            </div>
            <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 light:bg-emerald-100 light:text-emerald-700">
              Atualizado em tempo real
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
            {orderFlowColumns.map(column => {
              const columnOrders = flowOrdersByColumn[column.id];
              const action = column.action;

              return (
                <div key={column.id} className="min-h-[280px] rounded-lg bg-[#101010] dark:bg-[#101010] light:bg-gray-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm" aria-hidden="true">{column.icon}</span>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 light:text-gray-600">{column.title}</h3>
                    </div>
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1d1d1d] px-2 text-xs font-semibold text-gray-400 light:bg-gray-200 light:text-gray-700">
                      {columnOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {columnOrders.map(order => (
                      <article key={order.id} className="rounded-lg border border-[#242424] bg-[#151515] p-3 light:border-gray-200 light:bg-white">
                        <p className="text-xs font-bold text-[#00ff66]">#{order.id.replace('PED-', '')}</p>
                        <h4 className="mt-1 text-sm font-semibold text-white dark:text-white light:text-gray-900">{order.cliente}</h4>
                        <p className="mt-1 text-xs text-gray-500 light:text-gray-600">
                          {flowTimeByStatus[order.status] ?? 'Atualizado agora'}
                          {order.status === 'SAIU_PARA_ENTREGA' ? ` - ${getOrderDistance(order)}` : ''}
                        </p>

                        {action && (
                          <button
                            type="button"
                            onClick={() => updateOverviewOrderStatus(order.id, action.nextStatus)}
                            className={`mt-3 w-full rounded-md border px-3 py-2 text-xs font-bold transition-colors ${action.className}`}
                          >
                            {action.label} →
                          </button>
                        )}
                      </article>
                    ))}

                    {columnOrders.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[#2a2a2a] p-4 text-center text-xs text-gray-500 light:border-gray-300 light:text-gray-600">
                        Nenhum pedido nesta etapa.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (activeOverviewTab === 'ESTOQUE') {
      return (
        <section className="space-y-6">
          <NewOrderBanner
            message={`${stockNotice}${dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}`}
            onViewOrder={() => setActiveOverviewTab('PEDIDOS')}
            className="px-5 py-4 gap-4"
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-xl border border-[#222222] bg-[#151515] p-4 light:border-gray-200 light:bg-white">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Estoque - reservas ativas</h2>
                <button type="button" className="text-xs font-semibold text-[#00ff66]">Gerenciar estoque</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-y border-[#222222] text-xs uppercase text-gray-500 light:border-gray-200 light:text-gray-600">
                      <th className="py-3 font-semibold">Produto</th>
                      <th className="py-3 font-semibold">Disponível</th>
                      <th className="py-3 font-semibold">Reservado</th>
                      <th className="py-3 font-semibold">Distribuição</th>
                      <th className="py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStockRows.map(row => {
                      const reservedRatio = row.available > 0 ? Math.min(100, (row.reserved / row.available) * 100) : 100;
                      const isLow = row.available <= 20;
                      const hasReservation = row.reserved > 0;

                      return (
                        <tr key={row.product} className="border-b border-[#1f1f1f] text-sm light:border-gray-100">
                          <td className="py-4 font-medium text-white dark:text-white light:text-gray-900">{row.product}</td>
                          <td className={`py-4 ${isLow ? 'text-rose-400' : 'text-gray-300 light:text-gray-700'}`}>{row.available}</td>
                          <td className={`py-4 font-semibold ${hasReservation ? 'text-amber-300' : 'text-gray-500'}`}>
                            {row.reserved}
                          </td>
                          <td className="py-4">
                            <div className="h-1.5 w-24 rounded-full bg-[#262626] light:bg-gray-200">
                              <div
                                className={`h-1.5 rounded-full ${isLow ? 'bg-rose-500' : 'bg-[#00ff66]'}`}
                                style={{ width: `${Math.max(6, reservedRatio)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isLow
                                ? 'bg-rose-500/15 text-rose-300 light:bg-rose-100 light:text-rose-700'
                                : hasReservation
                                  ? 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
                                  : 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700'
                            }`}>
                              {isLow ? 'Baixo' : hasReservation ? 'Reservado' : 'Livre'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-[#222222] bg-[#151515] p-4 light:border-gray-200 light:bg-white">
              {dispatchOrder ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-white dark:text-white light:text-gray-900">
                      Confirmar despacho - #{dispatchOrder.id.replace('PED-', '')}
                    </h2>
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 light:bg-amber-100 light:text-amber-700">
                      Em separação
                    </span>
                  </div>

                  <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300 light:bg-amber-50 light:text-amber-700">
                    Ao confirmar, o estoque reservado será baixado definitivamente e o pedido sairá para entrega.
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Itens que serão baixados</p>
                    {dispatchOrder.itens.map(item => (
                      <div key={item.nome} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 light:text-gray-700">{item.nome}</span>
                        <span className="font-bold text-rose-400">-{item.quantidade} unid.</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-[#121212] p-3 light:bg-gray-50">
                    <div>
                      <p className="text-xs text-gray-500">Destino</p>
                      <p className="mt-1 text-sm font-semibold text-white dark:text-white light:text-gray-900">{dispatchOrder.cliente} - {getOrderDistance(dispatchOrder)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Previsão</p>
                      <p className="mt-1 text-sm font-semibold text-white dark:text-white light:text-gray-900">~35 min</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => confirmDispatchOrder(dispatchOrder)}
                      className="flex-1 rounded-md bg-[#00ff66] px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-[#22ff7a]"
                    >
                      Confirmar despacho
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[#2a2a2a] px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-[#202020] light:border-gray-200 light:text-gray-700 light:hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Nenhum pedido em separação</h2>
                  <p className="mt-2 max-w-sm text-sm !text-white dark:!text-white light:!text-gray-600">
                    Quando um pedido avançar para separação na aba Pedidos, ele aparecerá aqui para confirmar o despacho.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (activeOverviewTab === 'ENTREGAS') {
      return (
        <section className="space-y-4">
          <NewOrderBanner
            message={`${stockNotice}${dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}`}
            onViewOrder={() => setActiveOverviewTab('PEDIDOS')}
          />

          <div className="rounded-xl border border-[#222222] bg-[#151515] p-4 light:border-gray-200 light:bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Entregas do dia</h2>
              <span className="text-xs text-gray-500 light:text-gray-600">
                {deliveryOrders.length} total - {completedDeliveries} concluidas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-y border-[#222222] text-xs uppercase text-gray-500 light:border-gray-200 light:text-gray-600">
                    <th className="py-3 font-semibold">Pedido</th>
                    <th className="py-3 font-semibold">Cliente</th>
                    <th className="py-3 font-semibold">Previsao</th>
                    <th className="py-3 font-semibold">Dist.</th>
                    <th className="py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryOrders.map((order, index) => {
                    const estimatedTime = order.status === 'ENTREGUE'
                      ? '07:55'
                      : order.status === 'SAIU_PARA_ENTREGA'
                        ? '10:00'
                        : `${12 + index}:00`;

                    return (
                      <tr key={order.id} className="border-b border-[#1f1f1f] text-sm light:border-gray-100">
                        <td className="py-4 font-bold text-[#00ff66]">#{order.id.replace('PED-', '')}</td>
                        <td className="py-4 font-medium text-white dark:text-white light:text-gray-900">{order.cliente}</td>
                        <td className="py-4 text-gray-400 light:text-gray-600">{estimatedTime}</td>
                        <td className="py-4 text-gray-400 light:text-gray-600">{getOrderDistance(order)}</td>
                        <td className="py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getDeliveryStatusClass(order.status)}`}>
                            {getDeliveryStatus(order.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {deliveryOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-gray-500 light:text-gray-600">
                        Nenhuma entrega acompanhada no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      );
    }

    if (activeOverviewTab === 'RELATORIOS') {
      return (
        <section className="space-y-4">
          <NewOrderBanner
            message={`${stockNotice}${dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}`}
            onViewOrder={() => setActiveOverviewTab('PEDIDOS')}
          />

          <div className="rounded-xl border border-[#222222] bg-[#151515] p-6 md:p-8 light:border-gray-200 light:bg-white">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Relatório de desempenho</h2>
              <button
                type="button"
                onClick={() => {
                  void handleExportOrdersReport();
                }}
                disabled={isExportingOrdersReport}
                className="text-xs font-bold text-[#00ff66] disabled:opacity-60"
              >
                {isExportingOrdersReport ? 'Exportando...' : 'Exportar pedidos'}
              </button>
            </div>

            {isLoadingReports && (
              <p className="mb-4 text-xs text-gray-500 light:text-gray-600">Carregando relatórios...</p>
            )}

            {reportsError && (
              <p className="mb-4 text-xs text-amber-300 light:text-amber-700">{reportsError}</p>
            )}

            {!reportsError && reportsWarning && (
              <p className="mb-4 text-xs text-amber-300 light:text-amber-700">{reportsWarning}</p>
            )}

            {reportExportMessage && (
              <p className="mb-4 text-xs text-[#00ff66] light:text-green-700">{reportExportMessage}</p>
            )}

            {reportExportError && (
              <p className="mb-4 text-xs text-amber-300 light:text-amber-700">{reportExportError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">
                  {hasSalesData ? formatCurrency(salesRevenue) : 'R$ 0,00'}
                </h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Faturado hoje</p>
              </div>
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">{acceptanceRateValue}%</h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Taxa de aceite</p>
                {!hasAcceptanceDetails && (
                  <p className="mt-2 text-xs text-gray-500 light:text-gray-600">Sem dados suficientes.</p>
                )}
              </div>
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">{salesOrders}</h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Pedidos/mês</p>
              </div>
            </div>

            {!hasSalesData && (
              <p className="mt-4 text-xs text-gray-500 light:text-gray-600">Nenhum dado de venda disponível.</p>
            )}

            <div className="mt-8 border-t border-[#222222] pt-7 light:border-gray-200">
              <p className="mb-5 text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Mais pedidos esta semana</p>
              {hasTopProductsData ? (
                <div className="space-y-5">
                  {mappedTopProducts.map(product => (
                    <div key={product.key} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_52px] sm:items-center gap-2 sm:gap-5">
                      <span className="truncate text-sm text-gray-400 light:text-gray-700">{product.label}</span>
                      <div className="h-2.5 rounded-full bg-[#262626] light:bg-gray-200">
                        <div
                          className="h-2.5 rounded-full bg-[#00ff66]"
                          style={{ width: `${product.percent}%` }}
                        />
                      </div>
                      <span className="text-left text-xs text-gray-500 light:text-gray-600 sm:text-right">{product.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 light:text-gray-600">Nenhum produto vendido ainda.</p>
              )}
            </div>

            {renderReviewsInsights()}
          </div>
        </section>
      );
    }

    if (activeOverviewTab !== 'VISAO_GERAL') {
      return <div className="min-h-[280px]" />;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Novos Pedidos', value: String(dashboardKpis.pendingOrders) },
          { label: 'Em Preparo', value: String(dashboardKpis.preparingOrders) },
          { label: 'Saindo Hoje', value: String(dashboardKpis.deliveriesInProgress) },
          { label: 'Faturado (Mês)', value: formatCurrency(dashboardKpis.revenueToday) },
        ].map(card => (
          <KpiCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
    );
  };

  const renderSectionContent = () => {
    if (activeSection === 'PEDIDOS') {
      return (
        <OrderTable
          orders={overviewOrders}
          onOrdersChange={setOverviewOrders}
          stock={stock}
          setStock={setStock}
          onRegisterStockMovements={registerStockMovements}
        />
      );
    }

    if (activeSection === 'ESTOQUE') {
      return (
        <StockManagementSection
          stock={stock}
          setStock={setStock}
          movements={stockMovements}
          onRegisterMovements={registerStockMovements}
        />
      );
    }

    if (activeSection === 'ENTREGAS') {
      const todayPrimaryRoute = todayRoute[0];
      const selectedRoute = routeHistory.find(route => route.id === selectedRouteId)
        ?? todayRoute.find(route => route.id === selectedRouteId)
        ?? todayPrimaryRoute;

      return (
        <div className="mt-8 space-y-5">
          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold !text-white dark:!text-white light:!text-gray-900">Rota do dia</h2>
              <button
                type="button"
                onClick={() => {
                  void handleGenerateRoute();
                }}
                disabled={isSyncingRouteAction === 'generate' || !canGenerateRoute}
                className="rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 px-3 py-2 text-xs font-semibold hover:bg-[#00ff66]/25 disabled:opacity-60 transition-colors"
              >
                Gerar rota
              </button>
            </div>

            <p className="mb-3 text-xs text-gray-500 light:text-gray-600">
              A geração de rota depende de um entregador e de entregas com coordenadas.
            </p>

            {routeGenerationContext.missingCoordinatesCount > 0 && (
              <p className="mb-3 text-xs text-amber-300 light:text-amber-700">
                Algumas entregas não possuem coordenadas e não podem entrar na rota.
              </p>
            )}

            {!todayPrimaryRoute && (
              <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma rota planejada para hoje.</p>
            )}

            {todayPrimaryRoute && (
              <div className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white dark:text-white light:text-gray-900 font-medium">{todayPrimaryRoute.id}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 light:bg-violet-100 light:text-violet-700">
                    {getRouteStatusLabel(typeof todayPrimaryRoute.status === 'string' ? todayPrimaryRoute.status : undefined)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleStartRoute(todayPrimaryRoute.id);
                    }}
                    disabled={isSyncingRouteAction === `start:${todayPrimaryRoute.id}`}
                    className="rounded-md border border-[#2a2a2a] light:border-gray-200 px-3 py-1.5 text-xs text-gray-300 light:text-gray-700 hover:bg-[#202020] light:hover:bg-gray-100 disabled:opacity-60 transition-colors"
                  >
                    Iniciar rota
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCompleteRoute(todayPrimaryRoute.id);
                    }}
                    disabled={isSyncingRouteAction === `complete:${todayPrimaryRoute.id}`}
                    className="rounded-md border border-[#2a2a2a] light:border-gray-200 px-3 py-1.5 text-xs text-gray-300 light:text-gray-700 hover:bg-[#202020] light:hover:bg-gray-100 disabled:opacity-60 transition-colors"
                  >
                    Concluir rota
                  </button>
                </div>
              </div>
            )}

            {routeActionFeedback && (
              <p className="mt-3 text-xs text-[#00ff66] light:text-green-700">{routeActionFeedback}</p>
            )}

            {routeActionError && (
              <p className="mt-2 text-xs text-amber-300 light:text-amber-700">{routeActionError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900 mb-4">Histórico de rotas</h3>
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {routeHistory.map(route => (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      selectedRouteId === route.id
                        ? 'border-[#00ff66]/40 bg-[#00ff66]/10 light:bg-green-100 light:border-green-300'
                        : 'border-[#2a2a2a] light:border-gray-200 hover:bg-[#1a1a1a] light:hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{route.id}</p>
                    <p className="text-xs text-gray-500 light:text-gray-600 mt-1">
                      {getRouteStatusLabel(typeof route.status === 'string' ? route.status : undefined)}
                    </p>
                  </button>
                ))}

                {routeHistory.length === 0 && (
                  <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma rota registrada.</p>
                )}
              </div>
            </div>

            <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900 mb-4">Pontos de entrega</h3>

              {!selectedRoute && (
                <p className="text-sm text-gray-500 light:text-gray-600">Selecione uma rota para visualizar os pontos.</p>
              )}

              {selectedRoute && selectedRoutePoints.length === 0 && (
                <p className="text-sm text-gray-500 light:text-gray-600">Nenhum ponto de entrega encontrado para esta rota.</p>
              )}

              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {selectedRoutePoints.map(point => (
                  <div key={point.id} className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white dark:text-white light:text-gray-900">{point.address || point.id}</p>
                      <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 light:bg-violet-100 light:text-violet-700">
                        {getDeliveryPointStatusLabel(typeof point.status === 'string' ? point.status : undefined)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleArrivePoint(point.id);
                        }}
                        disabled={isSyncingRouteAction === `arrive:${point.id}`}
                        className="rounded-md border border-[#2a2a2a] light:border-gray-200 px-2.5 py-1 text-xs text-gray-300 light:text-gray-700 hover:bg-[#202020] light:hover:bg-gray-100 disabled:opacity-60 transition-colors"
                      >
                        Registrar chegada
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSendProof(point.id);
                        }}
                        disabled={isSyncingRouteAction === `proof:${point.id}`}
                        className="rounded-md border border-[#2a2a2a] light:border-gray-200 px-2.5 py-1 text-xs text-gray-300 light:text-gray-700 hover:bg-[#202020] light:hover:bg-gray-100 disabled:opacity-60 transition-colors"
                      >
                        Enviar prova
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleFailPoint(point.id);
                        }}
                        disabled={isSyncingRouteAction === `fail:${point.id}`}
                        className="rounded-md border border-[#2a2a2a] light:border-gray-200 px-2.5 py-1 text-xs text-gray-300 light:text-gray-700 hover:bg-[#202020] light:hover:bg-gray-100 disabled:opacity-60 transition-colors"
                      >
                        Registrar falha
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold !text-white dark:!text-white light:!text-gray-900 mb-4">Lista de entregas</h2>
            <div className="space-y-2">
              {deliveriesToday.map(order => (
                <div key={order.id} className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{order.id} - {order.cliente}</p>
                    <p className="text-xs text-gray-500">Entrega prevista: {order.dataDesejada}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 light:bg-violet-100 light:text-violet-700">
                    {order.status === 'ENTREGUE' ? 'Entregue' : 'Em rota'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'RELATORIOS') {
      return (
        <div className="mt-8 space-y-4">
          {isLoadingReports && (
            <div className="rounded-xl border border-[#222222] light:border-gray-200 bg-[#0d0d0d] dark:bg-[#0d0d0d] light:bg-white p-4 text-sm text-gray-300 light:text-gray-700">
              Carregando relatórios...
            </div>
          )}

          {reportsError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
              {reportsError}
            </div>
          )}

          {!reportsError && reportsWarning && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
              {reportsWarning}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <KpiCard
              label="Pedidos Aceitos"
              value={acceptanceRateReport?.acceptedOrders ?? 0}
              valueClassName="text-emerald-400 light:text-emerald-700"
            />
            <KpiCard
              label="Pedidos Recusados"
              value={acceptanceRateReport?.rejectedOrders ?? 0}
              valueClassName="text-rose-400 light:text-rose-700"
            />
            <KpiCard
              label="Em Separação"
              value={dashboardReport?.preparingOrders ?? 0}
              valueClassName="text-amber-400 light:text-amber-700"
            />
            <KpiCard label="Faturamento" value={formatCurrency(salesRevenue)} />
          </div>

          {renderReviewsInsights()}
        </div>
      );
    }

    if (activeSection === 'CONFIGURACOES') {
      return (
        <div className="mt-8 bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold !text-white dark:!text-white light:!text-gray-900">Configurações da conta</h2>
          <p className="text-sm text-gray-400 light:text-gray-600 mt-2">Em breve: notificações, integrações e preferências de operação.</p>
        </div>
      );
    }

    return renderOverviewContent();
  };

  const isOverviewWorkspace = activeSection === 'VISAO_GERAL' && (
    activeOverviewTab === 'PEDIDOS' ||
    activeOverviewTab === 'ESTOQUE' ||
    activeOverviewTab === 'ENTREGAS' ||
    activeOverviewTab === 'RELATORIOS'
  );



  return (
    <div className="flex w-full min-h-screen bg-[#050505] dark:bg-[#050505] light:bg-gray-50 transition-colors duration-300">
      <Sidebar
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        {isLoadingDashboard && (
          <div className="mb-6 rounded-xl border border-[#222222] light:border-gray-200 bg-[#0d0d0d] dark:bg-[#0d0d0d] light:bg-white p-4 text-sm text-gray-300 light:text-gray-700">
            Carregando dados do painel...
          </div>
        )}

        {!isLoadingDashboard && dashboardError && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
            {dashboardError}
          </div>
        )}

        {!isLoadingDashboard && !dashboardError && apiWarning && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:bg-amber-100 light:text-amber-700">
            {apiWarning}
          </div>
        )}

        {!isLoadingDashboard && inventoryNotInitialized && (
          <div className="mb-4 rounded-xl border border-[#222222] light:border-gray-200 bg-[#0d0d0d] dark:bg-[#0d0d0d] light:bg-white px-4 py-3 text-xs text-gray-400 light:text-gray-600">
            Estoque ainda não inicializado.
          </div>
        )}

        {!isLoadingDashboard && usingMockFallback && (
          <div className="mb-6 rounded-xl border border-[#222222] light:border-gray-200 bg-[#0d0d0d] dark:bg-[#0d0d0d] light:bg-white p-3 text-xs text-gray-400 light:text-gray-600">
            Exibindo dados demonstrativos. A API ainda nao esta disponivel.
          </div>
        )}

        {isLoadingDashboard ? null : (
          <>
        {activeSection === 'VISAO_GERAL' && (
          <div className="mb-6 rounded-xl border border-[#222222] light:border-gray-200 bg-[#0d0d0d] dark:bg-[#0d0d0d] light:bg-white p-4">
            <p className="text-xs text-gray-400 light:text-gray-600 mb-3">Dashboard / {activeOverviewLabel}</p>
            <nav className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topNavItems.map(item => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => setActiveOverviewTab(item.tab)}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-center ${
                    activeOverviewTab === item.tab
                      ? 'bg-[#00ff66]/10 text-[#00ff66] light:bg-green-100 light:text-green-700 border border-[#00ff66]/30'
                      : 'bg-[#141414] dark:bg-[#141414] light:bg-gray-50 text-gray-400 light:text-gray-700 border border-[#2a2a2a] light:border-gray-200 hover:text-gray-200 light:hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {!isOverviewWorkspace && <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between bg-[#00ff66]/10 border border-[#00ff66]/20 p-4 rounded-xl gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
            <span className="text-[#00ff66] font-medium text-sm md:text-base">Navegue pela Sidebar para operar pedidos, entregas, estoque e relatórios.</span>
          </div>
          <button onClick={() => setActiveSection('PEDIDOS')} className="text-[#00ff66] text-sm font-bold underline">Ir para pedidos</button>
        </div>}

        {!isOverviewWorkspace && <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-2xl font-bold !text-white dark:!text-white light:!text-gray-900">{headerTitle}</h1>
          <div className="flex items-center gap-4 text-gray-400">
            <div className="text-right">
              <p className="text-xs text-gray-500 light:text-gray-600">Perfil</p>
              <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{companyName}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#222222] light:bg-gray-200 light:border-gray-300" />
          </div>
        </header>}

        {renderSectionContent()}
          </>
        )}
      </main>
    </div>
  );
}
