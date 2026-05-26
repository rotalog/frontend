import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../services/api';
import type { Order, OrderStatus, OrderTimelineEvent, StockItem, StockMovement } from '../types/orders';
import type { ApiOrder, OrderTrackingResponse } from '../types/orders';
import type { PaymentResponse } from '../types/payments';
import { OrderApprovalPanel } from './OrderApprovalPanel';
import { acceptOrder, cancelOrder, dispatchOrder, getOrderById, getOrderTracking, prepareOrder, rejectOrder } from '../services/orders';
import { createPayment, getPaymentByOrderId } from '../services/payments';
import { mockOrders, orderStatusOptions } from '../data/mockData';
import { mapApiOrderToLegacyOrder } from '../utils/dashboardMappers';

const statusStyle: Record<OrderStatus, string> = {
  PENDENTE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-300',
  SOLICITADO: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-300',
  ACEITO: 'bg-sky-500/15 text-sky-400 border border-sky-500/30 light:bg-sky-100 light:text-sky-700 light:border-sky-300',
  REJEITADO: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 light:bg-rose-100 light:text-rose-700 light:border-rose-300',
  CANCELADO: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 light:bg-rose-100 light:text-rose-700 light:border-rose-300',
  PAGAMENTO_CONFIRMADO: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 light:bg-cyan-100 light:text-cyan-700 light:border-cyan-300',
  EM_SEPARACAO: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 light:bg-amber-100 light:text-amber-700 light:border-amber-300',
  SAIU_PARA_ENTREGA: 'bg-violet-500/15 text-violet-400 border border-violet-500/30 light:bg-violet-100 light:text-violet-700 light:border-violet-300',
  ENTREGUE: 'bg-teal-500/15 text-teal-400 border border-teal-500/30 light:bg-teal-100 light:text-teal-700 light:border-teal-300',
  RECUSADO: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 light:bg-rose-100 light:text-rose-700 light:border-rose-300',
};

const statusLabel: Record<OrderStatus, string> = {
  PENDENTE: 'Pendente',
  SOLICITADO: 'Novo',
  ACEITO: 'Aceito',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
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
  PENDING: 'PENDENTE',
  SOLICITADO: 'PENDENTE',
  PENDENTE: 'PENDENTE',
  RESERVED: 'ACEITO',
  ACCEPTED: 'ACEITO',
  ACEITO: 'ACEITO',
  REJECTED: 'REJEITADO',
  REJEITADO: 'REJEITADO',
  RECUSADO: 'REJEITADO',
  CANCELLED: 'CANCELADO',
  CANCELED: 'CANCELADO',
  CANCELADO: 'CANCELADO',
  PREPARING: 'EM_SEPARACAO',
  EM_SEPARACAO: 'EM_SEPARACAO',
  DISPATCHED: 'SAIU_PARA_ENTREGA',
  DELIVERED: 'ENTREGUE',
  SAIU_PARA_ENTREGA: 'SAIU_PARA_ENTREGA',
  ENTREGUE: 'ENTREGUE',
  PAYMENT_CONFIRMED: 'PAGAMENTO_CONFIRMADO',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
};

function isRejectedStatus(status: OrderStatus) {
  return status === 'REJEITADO' || status === 'CANCELADO' || status === 'RECUSADO';
}

function isValidApiId(id?: string): boolean {
  return typeof id === 'string' && id.length >= 20 && !id.startsWith('mock-');
}

function getOrderStatusLabel(order: Order): string {
  if (typeof order.statusDisplay === 'string' && order.statusDisplay.trim()) {
    return order.statusDisplay;
  }

  return statusLabel[order.status] ?? order.status;
}

function parseTrackingEvents(tracking: OrderTrackingResponse): Array<Record<string, unknown>> {
  if (!Array.isArray(tracking.events)) {
    return [];
  }

  return tracking.events
    .filter(event => Boolean(event && typeof event === 'object'))
    .map(event => event as Record<string, unknown>);
}

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
  const [trackingInfoMessage, setTrackingInfoMessage] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>((ordersProp ?? mockOrders)[0]?.id ?? null);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState('');
  void setStock;
  void onRegisterStockMovements;

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

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') {
      return orders;
    }

    return orders.filter(order => order.status === statusFilter);
  }, [orders, statusFilter]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    const stillVisible = selectedOrderId !== null && filteredOrders.some(order => order.id === selectedOrderId);
    if (!stillVisible) {
      setSelectedOrderId(filteredOrders[0]?.id ?? null);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) {
      return null;
    }

    return orders.find(order => order.id === selectedOrderId) ?? null;
  }, [orders, selectedOrderId]);

  const selectedTimeline = selectedOrder ? (timelineByOrder[selectedOrder.id] ?? []) : [];

  const reportData = useMemo(() => {
    const todayRef = '2026-04-26';
    const deliveriesToday = orders.filter(order =>
      order.dataDesejada === todayRef &&
      (order.status === 'SAIU_PARA_ENTREGA' || order.status === 'ENTREGUE'),
    );

    const accepted = orders.filter(order => !isRejectedStatus(order.status)).length;
    const rejected = orders.filter(order => isRejectedStatus(order.status)).length;
    const totalRevenue = orders
      .filter(order => !isRejectedStatus(order.status))
      .reduce((sum, order) => sum + order.valorTotal, 0);

    return {
      deliveriesToday,
      accepted,
      rejected,
      totalRevenue,
    };
  }, [orders]);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setTrackingInfoMessage('');
      return;
    }

    let active = true;

    const loadTracking = async () => {
      if (!isValidApiId(selectedOrder.id)) {
        setTrackingInfoMessage('Pedido sem ID real: ações indisponíveis.');
        return;
      }

      try {
        const tracking = await getOrderTracking(selectedOrder.id);
        if (!active) {
          return;
        }

        const events = parseTrackingEvents(tracking);
        if (events.length === 0) {
          setTrackingInfoMessage('');
          return;
        }

        const mappedEvents: OrderTimelineEvent[] = events.map((event, index) => {
          const normalizedStatus = normalizeApiStatus(event.status, selectedOrder.status);
          return {
            status: normalizedStatus,
            description: typeof event.description === 'string' ? event.description : `Evento de rastreio ${index + 1}`,
            createdAt: typeof event.createdAt === 'string' ? event.createdAt : new Date().toISOString(),
          };
        });

        setTimelineByOrder(current => ({
          ...current,
          [selectedOrder.id]: mappedEvents,
        }));

        setTrackingInfoMessage('');
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setTrackingInfoMessage('Tracking ainda não disponível para este pedido.');
          return;
        }

        setTrackingInfoMessage('');
      }
    };

    void loadTracking();

    return () => {
      active = false;
    };
  }, [selectedOrder?.id, selectedOrder?.status]);

  useEffect(() => {
    if (!selectedOrder?.id || !isValidApiId(selectedOrder.id)) {
      return;
    }

    let active = true;

    const loadOrderDetails = async () => {
      try {
        const apiOrder = await getOrderById(selectedOrder.id);
        if (!active) {
          return;
        }

        const mappedOrder = mapApiOrderToLegacyOrder(apiOrder);
        setOrders(current => current.map(order => (
          order.id === selectedOrder.id
            ? { ...order, ...mappedOrder, id: selectedOrder.id }
            : order
        )));
      } catch {
        // Keep list data when details endpoint fails.
      }
    };

    void loadOrderDetails();

    return () => {
      active = false;
    };
  }, [selectedOrder?.id]);

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
    const hasApiPayload = Boolean(apiResponse && Object.keys(apiResponse).length > 0);
    const nextStatus = normalizeApiStatus(apiResponse?.status, fallbackStatus);

    if (hasApiPayload) {
      const mappedOrder = mapApiOrderToLegacyOrder(apiResponse as ApiOrder);
      setOrders(currentOrders => currentOrders.map(order => (
        order.id === orderId
          ? {
            ...order,
            ...mappedOrder,
            id: orderId,
            status: nextStatus,
          }
          : order
      )));
    } else {
      applyOrderStatusLocally(orderId, nextStatus);
    }

    return nextStatus;
  };

  const setActionErrorFromApi = (error: unknown) => {
    if (error instanceof ApiError && error.status === 403) {
      setOrderActionError('Você não tem permissão para executar esta ação.');
      return;
    }

    if (error instanceof ApiError && error.status === 404) {
      setOrderActionError('Pedido não encontrado no backend.');
      return;
    }

    if (error instanceof ApiError && error.status === 409) {
      setOrderActionError('Este pedido não pode mudar para esse status no momento.');
      return;
    }

    if (error instanceof ApiError && error.status >= 500) {
      setOrderActionError('Erro interno ao atualizar pedido. Tente novamente em instantes.');
      return;
    }

    setOrderActionError('Erro ao atualizar pedido na API.');
  };

  const translatePaymentStatus = (status?: string): string => {
    if (!status) {
      return 'Sem status';
    }

    const normalized = status.toUpperCase();
    const map: Record<string, string> = {
      PENDING: 'Pendente',
      PAID: 'Pago',
      FAILED: 'Falhou',
      CANCELLED: 'Cancelado',
      EXPIRED: 'Expirado',
    };

    return map[normalized] ?? status;
  };

  const setPaymentErrorFromApi = (error: unknown) => {
    if (error instanceof ApiError && error.status === 403) {
      setPaymentError('Você não tem permissão para executar esta ação.');
      return;
    }

    if (error instanceof ApiError && error.status === 404) {
      setPaymentError('Pagamento não encontrado para este pedido.');
      return;
    }

    if (error instanceof ApiError && error.status === 409) {
      setPaymentError('Não foi possível criar pagamento para este pedido no status atual.');
      return;
    }

    if (error instanceof ApiError && error.status >= 500) {
      setPaymentError('Erro interno ao processar pagamento. Tente novamente em instantes.');
      return;
    }

    setPaymentError('Erro ao processar pagamento.');
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

  const handleAcceptOrder = async () => {
    if (!selectedOrder?.id || isSyncingOrder) {
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
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
    } catch (error) {
      setActionErrorFromApi(error);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleRejectOrder = async (reason: string) => {
    if (!selectedOrder?.id || isSyncingOrder) {
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await rejectOrder(selectedOrder.id, reason);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'REJEITADO');
      setRejectionReasons(current => ({ ...current, [selectedOrder.id]: reason }));
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, `Pedido recusado via API. Motivo: ${reason}`));
      setActionFeedback('Pedido recusado com sincronizacao da API.');
    } catch (error) {
      setActionErrorFromApi(error);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleConfirmPayment = () => {
    if (!selectedOrder?.id || !isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    applyOrderStatusLocally(selectedOrder.id, 'PAGAMENTO_CONFIRMADO');
    appendTimeline(selectedOrder.id, createTimelineEvent('PAGAMENTO_CONFIRMADO', 'Pagamento confirmado pelo financeiro.'));
    setActionFeedback('Pagamento confirmado localmente.');
  };

  const handleCreatePayment = async () => {
    if (!selectedOrder?.id || isCreatingPayment) {
      return;
    }

    setIsCreatingPayment(true);
    setPaymentError('');
    setPaymentFeedback('');

    if (!isValidApiId(selectedOrder.id)) {
      setPaymentError('Pedido sem ID real: ações indisponíveis.');
      setIsCreatingPayment(false);
      return;
    }

    const source = selectedOrder as unknown as Record<string, unknown>;
    const amountCandidate = source.valorTotal ?? source.totalAmount ?? source.amount ?? source.value;
    const parsedAmount = Number(amountCandidate);

    const payload = Number.isFinite(parsedAmount)
      ? { orderId: selectedOrder.id, amount: parsedAmount }
      : { orderId: selectedOrder.id };

    try {
      const payment = await createPayment(payload);
      setPaymentData(payment);
      setPaymentFeedback('Pagamento criado com sucesso.');
    } catch (error) {
      setPaymentErrorFromApi(error);
    } finally {
      setIsCreatingPayment(false);
    }
  };

  useEffect(() => {
    if (!selectedOrder?.id) {
      setPaymentData(null);
      setPaymentError('');
      setPaymentFeedback('');
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setPaymentData(null);
      setPaymentError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    let active = true;

    const loadPayment = async () => {
      setIsLoadingPayment(true);
      setPaymentError('');

      try {
        const payment = await getPaymentByOrderId(selectedOrder.id);
        if (!active) {
          return;
        }

        setPaymentData(payment);
      } catch (error) {
        if (!active) {
          return;
        }

        setPaymentErrorFromApi(error);
      } finally {
        if (active) {
          setIsLoadingPayment(false);
        }
      }
    };

    void loadPayment();

    return () => {
      active = false;
    };
  }, [selectedOrder?.id]);

  const handleStartPreparation = async () => {
    if (!selectedOrder?.id || isSyncingOrder) {
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await prepareOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'EM_SEPARACAO');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Separacao iniciada com sincronizacao da API.'));
      setActionFeedback('Pedido atualizado pela API para Em Separacao.');
    } catch (error) {
      setActionErrorFromApi(error);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleDispatch = async () => {
    if (!selectedOrder?.id || isSyncingOrder) {
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await dispatchOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'SAIU_PARA_ENTREGA');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Pedido despachado com sincronizacao da API.'));
      setActionFeedback('Pedido despachado com sincronizacao da API.');
    } catch (error) {
      setActionErrorFromApi(error);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder?.id || isSyncingOrder) {
      return;
    }

    if (!isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

    setIsSyncingOrder(selectedOrder.id);
    setOrderActionError('');

    try {
      const response = await cancelOrder(selectedOrder.id);
      const nextStatus = updateOrderFromApiOrFallback(selectedOrder.id, response as ApiOrderLike, 'CANCELADO');
      appendTimeline(selectedOrder.id, createTimelineEvent(nextStatus, 'Pedido cancelado via API.'));
      setActionFeedback('Pedido cancelado com sincronizacao da API.');
    } catch (error) {
      setActionErrorFromApi(error);
    } finally {
      setIsSyncingOrder('');
    }
  };

  const handleMarkDelivered = () => {
    if (!selectedOrder?.id || !isValidApiId(selectedOrder.id)) {
      setOrderActionError('Pedido sem ID real: ações indisponíveis.');
      return;
    }

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

          {trackingInfoMessage && (
            <p className="text-xs text-gray-400 light:text-gray-600">{trackingInfoMessage}</p>
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
                const isSelected = selectedOrder?.id === order.id;

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
                        {getOrderStatusLabel(order)}
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
        statusLabelOverride={selectedOrder ? getOrderStatusLabel(selectedOrder) : undefined}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        onConfirmPayment={handleConfirmPayment}
        onStartPreparation={handleStartPreparation}
        onDispatch={handleDispatch}
        onCancel={handleCancelOrder}
        onMarkDelivered={handleMarkDelivered}
        rejectionReason={selectedOrder ? rejectionReasons[selectedOrder.id] : undefined}
        timeline={selectedTimeline}
        stock={stock}
        actionFeedback={actionFeedback}
        isSyncing={Boolean(isSyncingOrder) && isSyncingOrder === (selectedOrder?.id ?? '')}
        payment={paymentData}
        paymentStatusLabel={translatePaymentStatus(paymentData?.status)}
        paymentError={paymentError}
        paymentFeedback={paymentFeedback}
        isLoadingPayment={isLoadingPayment}
        isCreatingPayment={isCreatingPayment}
        onCreatePayment={handleCreatePayment}
        isActionDisabled={selectedOrder ? !isValidApiId(selectedOrder.id) : false}
        actionDisabledMessage={selectedOrder && !isValidApiId(selectedOrder.id) ? 'Pedido sem ID real: ações indisponíveis.' : undefined}
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
                  {getOrderStatusLabel(order)}
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
