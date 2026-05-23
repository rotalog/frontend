export interface ApiInventoryItem {
  productId: string;
  productName?: string;
  sku?: string;
  quantity?: number;
  totalQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  badges?: string[];
  updatedAt?: string;
  [key: string]: unknown;
}

/** Shape returned by GET /inventory from the real backend. */
export interface InventoryResponse {
  inventoryId: string;
  productId: string;
  supplierId: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  badges: string[];
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
