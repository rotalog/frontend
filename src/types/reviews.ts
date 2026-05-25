export interface ReviewResponse {
  id: string;
  rating?: number;
  comment?: string;
  userId?: string;
  userName?: string;
  supplierId?: string;
  productId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface RatingSummaryResponse {
  averageRating?: number;
  totalReviews?: number;
  ratingDistribution?: Record<string, number>;
  [key: string]: unknown;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
  [key: string]: unknown;
}
