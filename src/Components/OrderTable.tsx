import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderStatus, OrderTimelineEvent, StockItem, StockMovement } from '../types/orders';
import { OrderApprovalPanel } from './OrderApprovalPanel';
import { acceptOrder, cancelOrder, dispatchOrder, getOrderTracking, prepareOrder, rejectOrder } from '../services/orders';
import { mockOrders, orderStatusOptions } from '../data/mockData';

const statusStyle: Record<OrderStatus, string> = {
  SOLICITADO: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-300',
  ACEITO: 'bg-sky-500/15 text-sky-400 border border-sky-500/30 light:bg-sky-100 light:text-sky-700 light:border-sky-300',
  PAGAMENTO_CONFIRMADO: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 light:bg-cyan-100 light:text-cyan-700 light:border-cyan-300',
  EM_SEPARACAO: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 light:bg-amber-100 light:text-amber-700 light:border-amber-300',
  SAIU_PARA_ENTREGA: 'bg-violet-500/15 text-violet-400 border border-violet-500/30 light:bg-violet-100 light:text-violet-700 light:border-violet-300',
  ENTREGUE: 'bg-teal-500/15 text-teal-400 border border-teal-500/30 light:bg-teal-100 light:text-teal-700 light:border-teal-300',
  RECUSADO: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 light:bg-rose-100 light:text-rose-700 light:border-rose-300',
};

const statusLabel: Record<OrderStatus, string> = {
  SOLICITADO: 'Novo',
  ACEITO: 'Reservado',
  PAGAMENTO_CONFIRMADO: 'Pagamento confirmado',
  EM_SEPARACAO: 'Em separacao',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  RECUSADO: 'Recusado',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function createTimelineEvent(status: OrderStatus, description: string): OrderTimelineEvent {
  return {
    status,
    description,
    createdAt: new Date().toISOString(),
  };
}

interface OrderTableProps {
  orders?: Order[];
  onOrdersChange?: (orders: Order[]) => void;
  stock: StockItem[];
  setStock: Dispatch<SetStateAction<StockItem[]>>;
  onRegisterStockMovements: (movements: Array<Omit<StockMovement, 'id' | 'createdAt'>>) => void;
}

type ApiOrderLike = {
  id?: string;
  status?: string;
  [key: string]: unknown;
};

const apiToLegacyStatus: Record<string, OrderStatus> = {
  PENDING: 'SOLICITADO',
  SOLICITADO: 'SOLICITADO',
  ACCEPTED: 'ACEITO',
  ACEITO: 'ACEITO',
  REJECTED: 'RECUSADO',
  RECUSADO: 'RECUSADO',
  CANCELED: 'RECUSADO',
  CANCELADO: 'RECUSADO',
  PREPARING: 'EM_SEPARACAO',
  EM_SEPARACAO: 'EM_SEPARACAO',
  DISPATCHED: 'SAIU_PARA_ENTREGA',
  SAIU_PARA_ENTREGA: 'SAIU_PARA_ENTREGA',
  DELIVERED: 'ENTREGUE',
  ENTREGUE: 'ENTREGUE',
  PAYMENT_CONFIRMED: 'PAGAMENTO_CONFIRMADO',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
};

const fallbackOrder: Order = {
  id: '',
  cliente: '',
  valorTotal: 0,
  status: 'SOLICITADO',
  dataDesejada: new Date().toISOString(),
  itens: [],
};

export function OrderTable({ orders: ordersProp, onOrdersChange, stock, setStock, onRegisterStockMovements }: OrderTableProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [orders, setOrdersState] = useState<Order[]>(ordersProp ?? mockOrders);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [timelineByOrder, setTimelineByOrder] = useState<Record<string, OrderTimelineEvent[]>>(() => {
    const baseOrders = ordersProp ?? mockOrders;
    return baseOrders.reduce<Record<string, OrderTimelineEvent[]>>((acc, order) => {
      acc[order.id] = [createTimelineEvent(order.status, `Pedido criado com status ${statusLabel[order.status]}.`)];
      return acc;
    }, {});
  });
  const [notification, setNotification] = useState<{ id: string; message: string } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string>('');
  const [isSyncingOrder, setIsSyncingOrder] = useState<string>('');
  const [orderActionError, setOrderActionError] = useState('');
  const [usingLocalOrderFallback, setUsingLocalOrderFallback] = useState(false);
  const [apiActionUnavailable, setApiActionUnavailable] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>((ordersProp ?? mockOrders)[0]?.id ?? '');
  const hasInjectedRealtimeOrder = useRef(false);

  const setOrders = (updater: SetStateAction<Order[]>) => {
    setOrdersState(current => {
      const next = typeof updater === 'function'
        ? (updater as (prev: Order[]) => Order[])(current)
        : updater;
      onOrdersChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    if (ordersProp !== undefined) {
      setOrdersState(ordersProp);
    }
  }, [ordersProp]);

  useEffect(() => {
    const missing = orders.filter(order => !timelineByOrder[order.id]);
    if (missing.length === 0) {
      return;
    }

    setTimelineByOrder(current => {
      const next = { ...current };
      missing.forEach(order => {
        next[order.id] = [createTimelineEvent(order.status, `Pedido carregado com status ${statusLabel[order.status]}.`)];
      });
      return next;
    });
  }, [orders, timelineByOrder]);

  useEffect(() => {
    if (ordersProp !== undefined) {
      return;
    }

    if (hasInjectedRealtimeOrder.current) {
      return;
    }

    hasInjectedRealtimeOrder.current = true;
    // simulacao temporaria de novo pedido enquanto WebSocket nao esta integrado.
    const timeoutId = window.setTimeout(() => {
      const realtimeOrder: Order = {
        id: 'PED-1050',
        cliente: 'Restaurante Nova Mesa',
        valorTotal: 640.7,
        status: 'SOLICITADO',
        dataDesejada: '2026-04-26',
        itens: [
          { nome: 'Molho de Tomate 340g', quantidade: 20, preco: 3.9 },
          { nome: 'Macarrao 500g', quantidade: 40, preco: 4.1 },
        ],
      };

      setOrders(current => [realtimeOrder, ...current]);
      setTimelineByOrder(current => ({
        ...current,
        [realtimeOrder.id]: [createTimelineEvent('SOLICITADO', 'Pedido recebido em tempo real.')],
      }));
      setNotification({
        id: realtimeOrder.id,
        message: `Novo pedido em tempo real: ${realtimeOrder.id} (${realtimeOrder.cliente})`,
      });
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [ordersProp]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') {
      return orders;
    }

    return orders.filter(order => order.status === statusFilter);
  }, [orders, statusFilter]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      return;
    }

    const stillVisible = filteredOrders.some(order => order.id === selectedOrderId);
    if (!stillVisible) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return orders.find(order => order.id === selectedOrderId) ?? orders[0] ?? fallbackOrder;
  }, [orders, selectedOrderId]);

  const selectedTimeline = timelineByOrder[selectedOrder.id] ?? [];

  const reportData = useMemo(() => {
    const todayRef = '2026-04-26';
    const deliveriesToday = orders.filter(order =>
      order.dataDesejada === todayRef &&
      (order.status === 'SAIU_PARA_ENTREGA' || order.status === 'ENTREGUE'),
    );

    const accepted = orders.filter(order => order.status !== 'RECUSADO').length;
    const rejected = orders.filter(order => order.status === 'RECUSADO').length;
    const totalRevenue = orders
      .filter(order => order.status !== 'RECUSADO')
      .reduce((sum, order) => sum + order.valorTotal, 0);

    return {
      deliveriesToday,
      accepted,
      rejected,
      totalRevenue,
    };
  }, [orders]);

  useEffect(() => {
    if (!selectedOrder.id) {
      return;
    }

    let active = true;

    const loadTracking = async () => {
      try {
        const tracking = await getOrderTracking(selectedOrder.id);
        if (!active || !Array.isArray(tracking.events) || tracking.events.length === 0) {
          return;
        }

        const mappedEvents: OrderTimelineEvent[] = tracking.events.map((event, index) => {
          const normalizedStatus = normalizeApiStatus(event.status, selectedOrder.status);
          return {
            status: normalizedStatus,
            description: event.description ?? `Evento de rastreio ${index + 1}`,
            createdAt: event.createdAt ?? new Date().toISOString(),
          };
        });

        setTimelineByOrder(current => ({
          ...current,
          [selectedOrder.id]: mappedEvents,
        }));
      } catch {
        // Keep local timeline when tracking API is unavailable.
      }
    };

    void loadTracking();

    return () => {
      active = false;
    };
  }, [selectedOrder.id, selectedOrder.status]);

  const normalizeApiStatus = (value: unknown, fallbackStatus: OrderStatus): OrderStatus => {
    if (typeof value !== 'string') {
      return fallbackStatus;
    }

    const normalized = value.toUpperCase();
    return apiToLegacyStatus[normalized] ?? fallbackStatus;
  };

  const applyOrderStatusLocally = (orderId: string, nextStatus: OrderStatus) => {
    setOrders(currentOrders =>
      currentOrders.map(order =>
        order.id === orderId
          ? { ...order, status: nextStatus }
          : order,
      ),
    );
  };

  const updateOrderFromApiOrFallback = (orderId: string, apiResponse: ApiOrderLike | null | undefined, fallbackStatus: OrderStatus) => {
    const nextStatus = normalizeApiStatus(apiResponse?.status, fallbackStatus);
    applyOrderStatusLocally(orderId, nextStatus);
    return nextStatus;
  };

  const appendTimeline = (orderId: string, event: OrderTimelineEvent) => {
    setTimelineByOrder(current => ({
      ...current,
      [orderId]: [...(current[orderId] ?? []), event],
    }));
  };

  const hasAvailableStockForOrder = (order: Order) => {
    return order.itens.every(item => {
      const stockEntry = stock.find(entry => entry.produto === item.nome);
      if (!stockEntry) {
        return false;
      }

      const disponivel = stockEntry.total - stockEntry.reservado;
      return disponivel >= item.quantidade;
    });
  };

  const reserveStockForOrder = (order: Order) => {
    // fallback local para demonstracao enquanto a reserva/baixa real de estoque fica no backend
    const movements = order.itens.map(item => ({
      product: item.nome,
      type: 'RESERVATION' as const,
      quantity: item.quantidade,
      source: `Pedido ${order.id} aceito`,
    }));

    setStock(currentStock =>
      currentStock.map(entry => {
        const orderItem = order.itens.find(item => item.nome === entry.produto);
        if (!orderItem) {
          return entry;
        }

        return { ...entry, reservado: entry.reservado + orderItem.quantidade };
      }),
    );

    onRegisterStockMovements(movements);
  };

  const finalizeDispatchForOrder = (order: Order) => {
    // fallback local para demonstracao enquanto a reserva/baixa real de estoque fica no backend
    const movements = order.itens.map(item => ({
      product: item.nome,
      type: 'EXIT' as const,
      quantity: item.quantidade,
      source: `Pedido ${order.id} despachado`,
    }));

    setStock(currentStock =>
      currentStock.map(entry => {
        const orderItem = order.itens.find(item => item.nome === entry.produto);
        if (!orderItem) {
          return entry;
        }

        return {
          ...entry,
          total: Math.max(0, entry.total - orderItem.quantidade),
          reservado: Math.max(0, entry.reservado - orderItem.quantidade),
        };
      }),
    );

    onRegisterStockMovements(movements);
  };

  const handleAcceptOrder = async () => {
    if (!selectedOrder.id || isSyncingOrder) {
      return;
    }

    if (!hasAvailableStockForOrder(selectedOrder)) {
      setActionFeedback('Estoque insuficiente para reservar todos os itens deste pedido.');
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await acceptOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'ACEITO');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Pedido aceito via API.'));
      setActionFeedback('Pedido aceito com sincronizacao da API.');
      setUsingLocalOrderFallback(false);
      setApiActionUnavailable(false);
    } catch {
      applyOrderStatusLocally(selectedOrder.id, 'ACEITO');
      reserveStockForOrder(selectedOrder);
      appendTimeline(selectedOrder.id, createTimelineEvent('ACEITO', 'Pedido aceito e estoque reservado localmente.'));
      setActionFeedback('API indisponivel. A acao foi simulada localmente.');
      setOrderActionError('API indisponivel. A acao foi simulada localmente.');
      setUsingLocalOrderFallback(true);
      setApiActionUnavailable(true);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleRejectOrder = async (reason: string) => {
    if (!selectedOrder.id || isSyncingOrder) {
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await rejectOrder(selectedOrder.id, reason);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'RECUSADO');
      setRejectionReasons(current => ({ ...current, [selectedOrder.id]: reason }));
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, `Pedido recusado via API. Motivo: ${reason}`));
      setActionFeedback('Pedido recusado com sincronizacao da API.');
      setUsingLocalOrderFallback(false);
      setApiActionUnavailable(false);
    } catch {
      applyOrderStatusLocally(selectedOrder.id, 'RECUSADO');
      setRejectionReasons(current => ({ ...current, [selectedOrder.id]: reason }));
      appendTimeline(selectedOrder.id, createTimelineEvent('RECUSADO', `Pedido recusado. Motivo: ${reason}`));
      setActionFeedback('API indisponivel. A acao foi simulada localmente.');
      setOrderActionError('API indisponivel. A acao foi simulada localmente.');
      setUsingLocalOrderFallback(true);
      setApiActionUnavailable(true);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleConfirmPayment = () => {
    applyOrderStatusLocally(selectedOrder.id, 'PAGAMENTO_CONFIRMADO');
    appendTimeline(selectedOrder.id, createTimelineEvent('PAGAMENTO_CONFIRMADO', 'Pagamento confirmado pelo financeiro.'));
    setActionFeedback('Pagamento confirmado localmente.');
  };

  const handleStartPreparation = async () => {
    if (!selectedOrder.id || isSyncingOrder) {
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await prepareOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'EM_SEPARACAO');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Separacao iniciada com sincronizacao da API.'));
      setActionFeedback('Pedido atualizado pela API para Em Separacao.');
      setUsingLocalOrderFallback(false);
      setApiActionUnavailable(false);
    } catch {
      applyOrderStatusLocally(selectedOrder.id, 'EM_SEPARACAO');
      appendTimeline(selectedOrder.id, createTimelineEvent('EM_SEPARACAO', 'Separacao iniciada no modo local.'));
      setActionFeedback('API indisponivel. A acao foi simulada localmente.');
      setOrderActionError('API indisponivel. A acao foi simulada localmente.');
      setUsingLocalOrderFallback(true);
      setApiActionUnavailable(true);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleDispatch = async () => {
    if (!selectedOrder.id || isSyncingOrder) {
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await dispatchOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'SAIU_PARA_ENTREGA');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Pedido despachado com sincronizacao da API.'));
      setActionFeedback('Pedido despachado com sincronizacao da API.');
      setUsingLocalOrderFallback(false);
      setApiActionUnavailable(false);
    } catch {
      finalizeDispatchForOrder(selectedOrder);
      applyOrderStatusLocally(selectedOrder.id, 'SAIU_PARA_ENTREGA');
      appendTimeline(selectedOrder.id, createTimelineEvent('SAIU_PARA_ENTREGA', 'Pedido despachado e estoque baixado definitivamente.'));
      setActionFeedback('API indisponivel. A acao foi simulada localmente.');
      setOrderActionError('API indisponivel. A acao foi simulada localmente.');
      setUsingLocalOrderFallback(true);
      setApiActionUnavailable(true);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder.id || isSyncingOrder) {
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await cancelOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'RECUSADO');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Pedido cancelado via API.'));
      setActionFeedback('Pedido cancelado com sincronizacao da API.');
      setUsingLocalOrderFallback(false);
      setApiActionUnavailable(false);
    } catch {
      applyOrderStatusLocally(selectedOrder.id, 'RECUSADO');
      appendTimeline(selectedOrder.id, createTimelineEvent('RECUSADO', 'Pedido cancelado no modo local.'));
      setActionFeedback('API indisponivel. A acao foi simulada localmente.');
      setOrderActionError('API indisponivel. A acao foi simulada localmente.');
      setUsingLocalOrderFallback(true);
      setApiActionUnavailable(true);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleMarkDelivered = () => {
    applyOrderStatusLocally(selectedOrder.id, 'ENTREGUE');
    appendTimeline(selectedOrder.id, createTimelineEvent('ENTREGUE', 'Entrega confirmada pelo fornecedor.'));
    setActionFeedback('Entrega concluida com sucesso.');
  };

  return (
    <section className="mt-8 grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
      <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222222] light:border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold !text-white dark:!text-white light:!text-gray-900">Pedidos recentes</h2>
            <p className="text-sm text-gray-500 light:text-gray-500">Clique na linha ou no botao para abrir os detalhes</p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="statusFilter" className="text-sm text-gray-400 light:text-gray-600">
              Filtrar:
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as 'ALL' | OrderStatus)}
              className="bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 text-sm text-white dark:text-white light:text-gray-900 rounded-md px-3 py-2 outline-none focus:border-[#00ff66] transition-colors"
            >
              <option value="ALL">Todos</option>
              {orderStatusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isSyncingOrder && (
            <p className="text-xs text-gray-400 light:text-gray-600">Sincronizando acao do pedido...</p>
          )}

          {orderActionError && (
            <p className="text-xs text-amber-300 light:text-amber-700">{orderActionError}</p>
          )}

          {usingLocalOrderFallback && apiActionUnavailable && (
            <p className="text-xs text-amber-300 light:text-amber-700">API indisponivel. A acao foi simulada localmente.</p>
          )}
        </div>

        {notification && (
          <div className="mx-5 mt-4 rounded-lg border border-[#00ff66]/30 bg-[#00ff66]/10 light:bg-green-100 light:border-green-300 p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-[#00ff66] light:text-green-700 font-medium">{notification.message}</p>
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId(notification.id);
                setNotification(null);
              }}
              className="text-xs px-2.5 py-1 rounded-md bg-[#00ff66]/20 text-[#00ff66] light:bg-green-200 light:text-green-800 hover:bg-[#00ff66]/30 transition-colors"
            >
              Ver pedido
            </button>
          </div>
        )}

        <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[#222222] light:border-gray-200 text-left">
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500 sticky top-0 z-10 bg-[#141414] dark:bg-[#141414] light:bg-white">Pedido</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500 sticky top-0 z-10 bg-[#141414] dark:bg-[#141414] light:bg-white">Cliente</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500 sticky top-0 z-10 bg-[#141414] dark:bg-[#141414] light:bg-white">Valor</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500 sticky top-0 z-10 bg-[#141414] dark:bg-[#141414] light:bg-white">Status</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500 sticky top-0 z-10 bg-[#141414] dark:bg-[#141414] light:bg-white">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const isSelected = selectedOrder.id === order.id;

                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`border-b border-[#222222] light:border-gray-200 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#00ff66]/10 light:bg-green-100/80'
                        : 'hover:bg-[#0f0f0f] light:hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white dark:text-white light:text-gray-900">{order.id}</td>
                    <td className="px-5 py-4 text-sm text-gray-300 light:text-gray-700">{order.cliente}</td>
                    <td className="px-5 py-4 text-sm text-gray-300 light:text-gray-700">{formatCurrency(order.valorTotal)}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedOrderId(order.id);
                        }}
                        className="px-3 py-1.5 rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 hover:bg-[#00ff66]/25 transition-colors"
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500 light:text-gray-500">
                    Nenhum pedido encontrado para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OrderApprovalPanel
        order={selectedOrder}
        statusLabel={statusLabel}
        statusStyle={statusStyle}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        onConfirmPayment={handleConfirmPayment}
        onStartPreparation={handleStartPreparation}
        onDispatch={handleDispatch}
        onCancel={handleCancelOrder}
        onMarkDelivered={handleMarkDelivered}
        rejectionReason={rejectionReasons[selectedOrder.id]}
        timeline={selectedTimeline}
        stock={stock}
        actionFeedback={actionFeedback}
        isSyncing={Boolean(isSyncingOrder) && isSyncingOrder === selectedOrder.id}
      />

      <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900 mb-3">Entregas do dia</h3>
          <ul className="space-y-2">
            {reportData.deliveriesToday.length === 0 && (
              <li className="text-sm text-gray-500 light:text-gray-500">Nenhuma entrega programada para hoje.</li>
            )}
            {reportData.deliveriesToday.map(order => (
              <li key={order.id} className="flex items-center justify-between rounded-lg border border-[#2a2a2a] light:border-gray-200 p-2.5">
                <span className="text-sm text-gray-300 light:text-gray-700">{order.id} - {order.cliente}</span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[order.status]}`}>
                  {statusLabel[order.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900 mb-3">Relatorios rapidos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
              <p className="text-xs text-gray-500">Aceitos</p>
              <p className="text-lg font-semibold text-emerald-400 light:text-emerald-700">{reportData.accepted}</p>
            </div>
            <div className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
              <p className="text-xs text-gray-500">Recusados</p>
              <p className="text-lg font-semibold text-rose-400 light:text-rose-700">{reportData.rejected}</p>
            </div>
            <div className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
              <p className="text-xs text-gray-500">Faturamento</p>
              <p className="text-lg font-semibold text-white dark:text-white light:text-gray-900">{formatCurrency(reportData.totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
