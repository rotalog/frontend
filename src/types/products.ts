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
  supplierId?: string;
  name: string;
  sku?: string;
  description?: string;
  price?: number;
  [key: string]: unknown;
}

export interface UpdateProductPayload {
  name?: string;
  sku?: string;
  description?: string;
  price?: number;
  active?: boolean;
  [key: string]: unknown;
}
