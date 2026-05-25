export interface InventoryResponse {
  inventoryId: string;
  productId: string;
  supplierId: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  badges: string[];
}

export interface InventoryAdjustmentPayload {
  quantity: number;
  reason: string;
}

export interface StockMovementResponse {
  id: string;
  inventoryId: string;
  productId: string;
  supplierId: string;
  movementType: string;
  quantity: number;
  referenceId?: string;
  reason?: string;
  createdAt: string;
}

// Backward-compatible aliases used by existing dashboard and mappers.
export type ApiInventoryItem = InventoryResponse;
export type UpdateInventoryPayload = InventoryAdjustmentPayload;
export type InventoryMovement = StockMovementResponse;
