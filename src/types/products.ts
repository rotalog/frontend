export interface ApiProduct {
  id: string;
  supplierId: string;
  name: string;
  minStockLevel: number;
  imageUrl?: string;
}

export interface CreateProductPayload {
  name: string;
  minStockLevel: number;
  imageUrl?: string;
}

export interface UpdateProductPayload {
  name?: string;
  minStockLevel?: number;
  imageUrl?: string;
}
