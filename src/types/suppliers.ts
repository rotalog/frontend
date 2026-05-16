export interface ApiSupplier {
  id: string;
  companyName?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  companyEmail?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UpdateSupplierPayload {
  companyName?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  companyEmail?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface NearbySuppliersParams {
  lat: number;
  lng: number;
  radius: number;
}
