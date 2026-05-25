import { api, ApiError } from './api';
import type { CreateReviewPayload, RatingSummaryResponse, ReviewResponse } from '../types/reviews';

const EMPTY_RATING_SUMMARY: RatingSummaryResponse = {
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: {},
};

export function isValidApiId(id?: string): boolean {
  return Boolean(id) && !String(id).startsWith('mock-') && String(id).length >= 20;
}

export async function getSupplierReviews(supplierId: string): Promise<ReviewResponse[]> {
  if (!isValidApiId(supplierId)) {
    return [];
  }

  try {
    return await api<ReviewResponse[]>(`/suppliers/${supplierId}/reviews`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createSupplierReview(supplierId: string, payload: CreateReviewPayload): Promise<ReviewResponse> {
  if (!isValidApiId(supplierId)) {
    throw new Error('Supplier ID inválido para criar avaliação.');
  }

  return api<ReviewResponse>(`/suppliers/${supplierId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSupplierRatingSummary(supplierId: string): Promise<RatingSummaryResponse> {
  if (!isValidApiId(supplierId)) {
    return { ...EMPTY_RATING_SUMMARY };
  }

  try {
    return await api<RatingSummaryResponse>(`/suppliers/${supplierId}/rating-summary`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { ...EMPTY_RATING_SUMMARY };
    }

    throw error;
  }
}

export async function getProductReviews(productId: string): Promise<ReviewResponse[]> {
  if (!isValidApiId(productId)) {
    return [];
  }

  try {
    return await api<ReviewResponse[]>(`/products/${productId}/reviews`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function createProductReview(productId: string, payload: CreateReviewPayload): Promise<ReviewResponse> {
  if (!isValidApiId(productId)) {
    throw new Error('Product ID inválido para criar avaliação.');
  }

  return api<ReviewResponse>(`/products/${productId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProductRatingSummary(productId: string): Promise<RatingSummaryResponse> {
  if (!isValidApiId(productId)) {
    return { ...EMPTY_RATING_SUMMARY };
  }

  try {
    return await api<RatingSummaryResponse>(`/products/${productId}/rating-summary`, {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { ...EMPTY_RATING_SUMMARY };
    }

    throw error;
  }
}
