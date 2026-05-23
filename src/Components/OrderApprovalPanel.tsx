import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Order, OrderStatus, OrderTimelineEvent, StockItem } from '../types/orders';

interface OrderApprovalPanelProps {
  order: Order;
  statusLabel: Record<OrderStatus, string>;
  statusStyle: Record<OrderStatus, string>;
  statusLabelOverride?: string;
  onAccept: () => void;
  onReject: (reason: string) => void;
  onConfirmPayment: () => void;
  onStartPreparation: () => void;
  onDispatch: () => void;
  onCancel: () => void;
  onMarkDelivered: () => void;
  rejectionReason?: string;
  timeline: OrderTimelineEvent[];
  stock: StockItem[];
  actionFeedback?: string;
  isSyncing?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(isoDate));
}

function formatDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function OrderApprovalPanel({
  order,
  statusLabel,
  statusStyle,
  statusLabelOverride,
  onAccept,
  onReject,
  onConfirmPayment,
  onStartPreparation,
  onDispatch,
  onCancel,
  onMarkDelivered,
  rejectionReason,
  timeline,
  stock,
  actionFeedback,
  isSyncing = false,
}: OrderApprovalPanelProps) {
  const [rejectionInput, setRejectionInput] = useState('');
  const [showRejectError, setShowRejectError] = useState(false);

  const handleExportTimelineXlsx = () => {
    if (timeline.length === 0) {
      return;
    }

    const rows = timeline.map(event => ({
      pedido: order.id,
      status: statusLabel[event.status],
      descricao: event.description,
      data_hora: formatDateTime(event.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timeline');
    XLSX.writeFile(workbook, `timeline-${order.id}.xlsx`);
  };

  const handleReject = () => {
    const reason = rejectionInput.trim();
    if (!reason) {
      setShowRejectError(true);
      return;
    }

    setShowRejectError(false);
    onReject(reason);
    setRejectionInput('');
  };

  return (
    <aside className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl p-5 h-fit">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Painel de detalhes</h3>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[order.status]}`}>
          {statusLabelOverride ?? statusLabel[order.status]}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-400 light:text-gray-500">Pedido</p>
        <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{order.id}</p>
        <p className="text-sm text-gray-400 light:text-gray-500">Cliente</p>
        <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{order.cliente}</p>
        <p className="text-sm text-gray-400 light:text-gray-500">Entrega desejada</p>
        <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{formatDate(order.dataDesejada)}</p>
        <p className="text-sm text-gray-400 light:text-gray-500">Valor total</p>
        <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">{formatCurrency(order.valorTotal)}</p>
      </div>

      <div className="border-t border-[#222222] light:border-gray-200 pt-4">
        <p className="text-sm font-medium text-white dark:text-white light:text-gray-900 mb-3">Itens do pedido</p>
        <ul className="space-y-2 mb-4">
          {order.itens.map(item => {
            const stockItem = stock.find(entry => entry.produto === item.nome);

            return (
              <li key={item.nome} className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 light:text-gray-700">{item.quantidade} cx {item.nome}</span>
                  <span className="text-gray-400 light:text-gray-500">{formatCurrency(item.preco * item.quantidade)}</span>
                </div>
                {stockItem && (
                  <p className="mt-1 text-xs text-gray-500 light:text-gray-500">
                    Estoque: Total {stockItem.total} / Reservado {stockItem.reservado} / Disponivel {stockItem.total - stockItem.reservado}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {(order.status === 'SOLICITADO' || order.status === 'PENDENTE') && (
          <>
            <div className="space-y-2 mb-4">
              <label htmlFor="rejectionReason" className="block text-sm font-medium text-white dark:text-white light:text-gray-900">
                Motivo da recusa
              </label>
              <textarea
                id="rejectionReason"
                value={rejectionInput}
                onChange={event => {
                  setRejectionInput(event.target.value);
                  if (showRejectError && event.target.value.trim()) {
                    setShowRejectError(false);
                  }
                }}
                rows={3}
                placeholder="Campo obrigatorio para recusar o pedido"
                className="w-full rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-3 py-2 text-sm text-white dark:text-white light:text-gray-900 placeholder:text-gray-500 outline-none focus:border-[#00ff66] transition-colors"
              />
              {showRejectError && (
                <p className="text-xs text-red-400 light:text-red-600">Informe o motivo para recusar a venda.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={isSyncing}
                className="rounded-lg px-3 py-2 text-sm font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-300 transition-colors"
              >
                Aceitar (reservar estoque)
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSyncing}
                className="rounded-lg px-3 py-2 text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 light:bg-red-100 light:text-red-700 light:border-red-300 transition-colors"
              >
                Recusar pedido
              </button>
            </div>
          </>
        )}

        {order.status === 'ACEITO' && (
          <button
            type="button"
            onClick={onConfirmPayment}
            disabled={isSyncing}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30 light:bg-sky-100 light:text-sky-700 light:border-sky-300 transition-colors"
          >
            Confirmar pagamento
          </button>
        )}

        {order.status === 'PAGAMENTO_CONFIRMADO' && (
          <button
            type="button"
            onClick={onStartPreparation}
            disabled={isSyncing}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 light:bg-amber-100 light:text-amber-700 light:border-amber-300 transition-colors"
          >
            Marcar como Em Separacao
          </button>
        )}

        {order.status === 'EM_SEPARACAO' && (
          <button
            type="button"
            onClick={onDispatch}
            disabled={isSyncing}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/40 hover:bg-violet-500/30 light:bg-violet-100 light:text-violet-700 light:border-violet-300 transition-colors"
          >
            Despachar para entrega (baixar estoque)
          </button>
        )}

        {(
          order.status === 'SOLICITADO' ||
          order.status === 'PENDENTE' ||
          order.status === 'ACEITO' ||
          order.status === 'PAGAMENTO_CONFIRMADO' ||
          order.status === 'EM_SEPARACAO'
        ) && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSyncing}
            className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 light:bg-rose-100 light:text-rose-700 light:border-rose-300 transition-colors"
          >
            Cancelar pedido
          </button>
        )}

        {order.status === 'SAIU_PARA_ENTREGA' && (
          <button
            type="button"
            onClick={onMarkDelivered}
            disabled={isSyncing}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30 light:bg-teal-100 light:text-teal-700 light:border-teal-300 transition-colors"
          >
            Marcar como Entregue
          </button>
        )}

        {(order.status === 'RECUSADO' || order.status === 'REJEITADO' || order.status === 'CANCELADO') && rejectionReason && (
          <p className="mt-3 text-sm text-red-400 light:text-red-700">
            Motivo informado: {rejectionReason}
          </p>
        )}

        {actionFeedback && (
          <p className="mt-3 text-sm text-gray-400 light:text-gray-600">{actionFeedback}</p>
        )}

        <div className="mt-4 border-t border-[#222222] light:border-gray-200 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white dark:text-white light:text-gray-900">Timeline de auditoria</p>
            <button
              type="button"
              onClick={handleExportTimelineXlsx}
              disabled={timeline.length === 0}
              className="text-xs px-2.5 py-1 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:text-[#00ff66] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Exportar XLSX
            </button>
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {timeline.length === 0 && (
              <li className="text-xs text-gray-500 light:text-gray-500">Sem eventos para este pedido.</li>
            )}
            {[...timeline].reverse().map((event, index) => (
              <li key={`${event.createdAt}-${event.status}-${index}`} className="rounded-md border border-[#2a2a2a] light:border-gray-200 p-2">
                <p className="text-xs text-gray-300 light:text-gray-700">{event.description}</p>
                <p className="text-[11px] text-gray-500 mt-1">{formatDateTime(event.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
