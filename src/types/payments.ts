export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | string;

export interface CreatePaymentPayload {
  orderId: string;
  amount?: number;
  method?: string;
  [key: string]: unknown;
}

export interface PaymentResponse {
  id?: string;
  paymentId?: string;
  orderId: string;
  status?: PaymentStatus;
  amount?: number;
  paymentUrl?: string;
  qrCode?: string;
  qrCodeText?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
