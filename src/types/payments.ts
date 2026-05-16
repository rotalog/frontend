export interface CreatePaymentPayload {
  orderId: string;
  method?: string;
  amount?: number;
  [key: string]: unknown;
}

export interface PaymentStatus {
  orderId: string;
  paymentId?: string;
  status?: string;
  amount?: number;
  paidAt?: string;
  [key: string]: unknown;
}
