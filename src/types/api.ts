export interface ApiListResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface ApiMessageResponse {
  message?: string;
  success?: boolean;
  [key: string]: unknown;
}

export interface ApiStatusResponse {
  status?: string;
  [key: string]: unknown;
}
