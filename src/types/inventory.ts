export interface ApiInventoryItem {
  productId: string;
  productName?: string;
  sku?: string;
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UpdateInventoryPayload {
  quantity: number;
  reason: string;
  [key: string]: unknown;
}

export interface InventoryMovement {
  id: string;
  productId?: string;
  productName?: string;
  type: string;
  quantity: number;
  createdAt?: string;
  source?: string;
  [key: string]: unknown;
}
