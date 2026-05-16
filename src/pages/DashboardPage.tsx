import { useEffect, useMemo, useState } from 'react';
import { Sidebar, type DashboardSection } from '../Components/Sidebar';
import { OrderTable } from '../Components/OrderTable';
import { StockManagementSection } from '../Components/StockManagementSection';
import { mockOrders, mockStock } from '../data/mockData';
import { getInventory } from '../services/inventory';
import { getOrders } from '../services/orders';
import { getDashboardReport } from '../services/reports';
import { getTodayRoute } from '../services/routes';
import type { ApiInventoryItem } from '../types/inventory';
import type { ApiRoute } from '../types/routes';
import type { Order, OrderStatus, StockMovement } from '../types/orders';
import type { ApiOrder } from '../types/orders';
import type { DashboardReport } from '../types/reports';
import {
  calculateFallbackKpis,
  getNumberValue,
  mapApiInventoryToLegacyStock,
  mapApiOrderToLegacyOrder,
} from '../utils/dashboardMappers';

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
  const [todayRoute, setTodayRoute] = useState<ApiRoute | null>(null);
  const [usingMockFallback, setUsingMockFallback] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      setIsLoadingDashboard(true);
      setDashboardError('');

      const [reportResult, ordersResult, inventoryResult, routeResult] = await Promise.allSettled([
        getDashboardReport(),
        getOrders(),
        getInventory(),
        getTodayRoute(),
      ]);

      if (!active) {
        return;
      }

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
        hasMockFallback = true;
      }

      if (inventoryResult.status === 'fulfilled') {
        setApiInventory(inventoryResult.value);
        setStock(inventoryResult.value.map(mapApiInventoryToLegacyStock));
        hasSuccess = true;
      } else {
        setApiInventory([]);
        setStock(mockStock);
        hasMockFallback = true;
      }

      if (routeResult.status === 'fulfilled') {
        setTodayRoute(routeResult.value);
        hasSuccess = true;
      } else {
        setTodayRoute(null);
      }

      const hasPartialError = [reportResult, ordersResult, inventoryResult, routeResult]
        .some(result => result.status === 'rejected');

      if (!hasSuccess) {
        hasMockFallback = true;
        setOverviewOrders(mockOrders);
        setStock(mockStock);
      }

      if (!hasSuccess || hasPartialError) {
        setDashboardError('Nao foi possivel carregar todos os dados da API. Alguns dados demonstrativos estao sendo exibidos.');
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
    const revenueToday = getNumberValue(source, ['totalRevenue', 'faturamentoTotal', 'revenueToday'], fallbackKpis.revenueToday);
    const totalOrders = getNumberValue(source, ['totalOrders', 'pedidosTotal'], fallbackKpis.totalOrders);
    const pendingOrders = getNumberValue(source, ['pendingOrders', 'pedidosPendentes'], fallbackKpis.pendingOrders);
    const preparingOrders = getNumberValue(source, ['preparingOrders', 'pedidosEmSeparacao'], fallbackKpis.preparingOrders);
    const acceptanceRate = getNumberValue(source, ['acceptanceRate', 'taxaAceite'], fallbackKpis.acceptanceRate);
    const lowStockCount = getNumberValue(source, ['lowStockCount', 'estoqueBaixo'], fallbackKpis.lowStockCount);

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

  const reportSummary = useMemo(() => {
    const accepted = overviewOrders.filter(order => order.status !== 'RECUSADO').length;
    const rejected = overviewOrders.filter(order => order.status === 'RECUSADO').length;
    const preparing = overviewOrders.filter(order => order.status === 'EM_SEPARACAO').length;
    const revenue = overviewOrders
      .filter(order => order.status !== 'RECUSADO')
      .reduce((sum, order) => sum + order.valorTotal, 0);

    return { accepted, rejected, preparing, revenue };
  }, [overviewOrders]);

  const deliveriesToday = useMemo(() => {
    return overviewOrders.filter(order => order.status === 'SAIU_PARA_ENTREGA' || order.status === 'ENTREGUE');
  }, [overviewOrders]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
    return overviewOrders.filter(order => order.status !== 'SOLICITADO' && order.status !== 'RECUSADO');
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

  const completedDeliveries = useMemo(() => {
    return deliveryOrders.filter(order => order.status === 'ENTREGUE').length;
  }, [deliveryOrders]);

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00ff66]" />
              <p className="text-sm font-semibold leading-6 text-[#00ff66]">
                {stockNotice}
                {dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveOverviewTab('PEDIDOS')}
              className="w-fit rounded-md bg-[#00ff66] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[#22ff7a]"
            >
              Ver pedido →
            </button>
          </div>

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00ff66]" />
              <p className="text-sm font-semibold text-[#00ff66]">
                {stockNotice}
                {dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveOverviewTab('PEDIDOS')}
              className="w-fit rounded-md bg-[#00ff66] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[#22ff7a]"
            >
              Ver pedido →
            </button>
          </div>

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00ff66]" />
              <p className="text-sm font-semibold text-[#00ff66]">
                {stockNotice}
                {dispatchOrder ? ` - ${formatCurrency(dispatchOrder.valorTotal)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveOverviewTab('PEDIDOS')}
              className="w-fit rounded-md bg-[#00ff66] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[#22ff7a]"
            >
              Ver pedido →
            </button>
          </div>

          <div className="rounded-xl border border-[#222222] bg-[#151515] p-6 md:p-8 light:border-gray-200 light:bg-white">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold !text-white dark:!text-white light:!text-gray-900">Relatório de desempenho</h2>
              <button type="button" className="text-xs font-bold text-[#00ff66]">Ver completo</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">
                  {formatCurrency(dashboardKpis.revenueToday)}
                </h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Faturado hoje</p>
              </div>
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">{dashboardKpis.acceptanceRate}%</h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Taxa de aceite</p>
              </div>
              <div className="rounded-lg bg-[#181818] p-6 light:bg-gray-50">
                <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900">{dashboardKpis.monthlyOrders}</h3>
                <p className="mt-3 text-xs text-gray-500 light:text-gray-600">Pedidos/mês</p>
              </div>
            </div>

            <div className="mt-8 border-t border-[#222222] pt-7 light:border-gray-200">
              <p className="mb-5 text-xs uppercase tracking-wide text-gray-500 light:text-gray-600">Mais pedidos esta semana</p>
              <div className="space-y-5">
                {dashboardKpis.topProducts.map(product => (
                  <div key={product.name} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_52px] sm:items-center gap-2 sm:gap-5">
                    <span className="truncate text-sm text-gray-400 light:text-gray-700">{product.name}</span>
                    <div className="h-2.5 rounded-full bg-[#262626] light:bg-gray-200">
                      <div
                        className="h-2.5 rounded-full bg-[#00ff66]"
                        style={{ width: `${Math.max(8, product.percent)}%` }}
                      />
                    </div>
                    <span className="text-left text-xs text-gray-500 light:text-gray-600 sm:text-right">{product.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
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
          <div key={card.label} className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 light:text-gray-400 text-sm">{card.label}</p>
            <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900 mt-1">{card.value}</h3>
          </div>
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
      return (
        <div className="mt-8 bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
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
      );
    }

    if (activeSection === 'RELATORIOS') {
      return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 light:text-gray-400 text-sm">Pedidos Aceitos</p>
            <h3 className="text-2xl font-bold text-emerald-400 light:text-emerald-700 mt-1">{reportSummary.accepted}</h3>
          </div>
          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 light:text-gray-400 text-sm">Pedidos Recusados</p>
            <h3 className="text-2xl font-bold text-rose-400 light:text-rose-700 mt-1">{reportSummary.rejected}</h3>
          </div>
          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 light:text-gray-400 text-sm">Em Separação</p>
            <h3 className="text-2xl font-bold text-amber-400 light:text-amber-700 mt-1">{reportSummary.preparing}</h3>
          </div>
          <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 p-6 rounded-xl shadow-sm">
            <p className="text-gray-500 light:text-gray-400 text-sm">Faturamento</p>
            <h3 className="text-2xl font-bold text-white dark:text-white light:text-gray-900 mt-1">{formatCurrency(reportSummary.revenue)}</h3>
          </div>
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

  const hasApiData = apiOrders.length > 0 || apiInventory.length > 0 || Boolean(dashboardReport) || Boolean(todayRoute);

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
            Nao foi possivel carregar todos os dados da API. Alguns dados demonstrativos estao sendo exibidos.
            {hasApiData ? ' Dados da API foram carregados parcialmente.' : ''}
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
