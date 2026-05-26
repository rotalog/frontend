import type { Order, OrderStatus, StockItem } from '../types/orders';

export const orderStatusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: 'SOLICITADO', label: 'Novo' },
  { value: 'ACEITO', label: 'Reservado' },
  { value: 'PAGAMENTO_CONFIRMADO', label: 'Pagamento confirmado' },
  { value: 'EM_SEPARACAO', label: 'Em separacao' },
  { value: 'SAIU_PARA_ENTREGA', label: 'Saiu para entrega' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'RECUSADO', label: 'Recusado' },
];

export const mockOrders: Order[] = [
  {
    id: 'PED-1042',
    cliente: 'Mercado Aurora',
    valorTotal: 1280.9,
    status: 'SOLICITADO',
    dataDesejada: '2026-05-27',
    itens: [
      { nome: 'Arroz 5kg', quantidade: 12, preco: 26.9 },
      { nome: 'Feijao 1kg', quantidade: 20, preco: 8.5 },
    ],
  },
];

export const mockStock: StockItem[] = [
  { codigo: 'ARR001', produto: 'Arroz 5kg', total: 180, reservado: 0 },
  { codigo: 'FEJ001', produto: 'Feijao 1kg', total: 250, reservado: 0 },
  { codigo: 'ACU001', produto: 'Acucar 1kg', total: 250, reservado: 30 },
  { codigo: 'CAF001', produto: 'Cafe 500g', total: 150, reservado: 10 },
  { codigo: 'OLE001', produto: 'Oleo 900ml', total: 300, reservado: 0 },
  { codigo: 'MAC001', produto: 'Macarrao 500g', total: 450, reservado: 0 },
  { codigo: 'FAR001', produto: 'Farinha 1kg', total: 215, reservado: 25 },
  { codigo: 'MOL001', produto: 'Molho de Tomate 340g', total: 260, reservado: 0 },
];
