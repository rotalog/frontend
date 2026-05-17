export interface ApiProduct {
  id: string;
  supplierId?: string;
  name: string;
  sku?: string;
  description?: string;
  price?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CreateProductPayload {
  name: string;
  minStockLevel: number;
  [key: string]: unknown;
}

export interface UpdateProductPayload {
  name: string;
  minStockLevel: number;
  [key: string]: unknown;
}
