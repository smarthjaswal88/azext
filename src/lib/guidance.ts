/** Contract between the guidance route and the comparison UI.
 *
 *  Review confidence is computed on the server and is not part of what the
 *  model returns — see src/server/ai/confidence.ts. */

export const MAX_PREFERENCE_CHARS = 280;
export const MAX_GUIDANCE_PRODUCTS = 3;
export const MAX_REVIEWS_PER_PRODUCT = 4;

export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";

export interface GuidanceReviewRef {
  id: string;
  rating: number;
  title: string;
  excerpt: string;
  variantLabel?: string;
  verifiedPurchase: boolean;
}

export interface GuidanceConfidence {
  level: ConfidenceLevel;
  label: string;
  reason: string;
  analysedCount: number;
}

export interface GuidanceBudgetCheck {
  /** The shopper's stated ceiling, parsed in code — never by the model. */
  limitCents: number;
  priceCents: number;
  withinBudget: boolean;
  /** True when no size is chosen, so the price is indicative only. */
  provisional: boolean;
}

export interface GuidanceProduct {
  slug: string;
  title: string;
  /** Computed on the server from deterministic rules. */
  confidence: GuidanceConfidence;
  /** The review records the model was given, for the shopper to inspect. */
  analysedReviews: GuidanceReviewRef[];
  /** Model output, validated. */
  matchSummary: string;
  tradeoffs: string[];
  unknowns: string[];
  /** Review ids the model cited, already checked against what it was sent. */
  citedReviewIds: string[];
  /** Present only when the shopper stated a budget. */
  budget?: GuidanceBudgetCheck;
  /** True when no size is chosen, so any price shown is indicative. */
  priceProvisional: boolean;
}

export interface GuidanceSuggestion {
  /** null means "no clear match", which is a legitimate answer. */
  slug: string | null;
  reasons: string[];
  tradeoffs: string[];
}

export interface GuidanceResult {
  model: string;
  /** Echoed back so the client can discard a response for a stale selection. */
  requestId: string;
  products: GuidanceProduct[];
  /** Only when preferences were supplied. */
  suggestion?: GuidanceSuggestion;
  /** Only when they were not: differences without a personalised winner. */
  differences?: string[];
  cached: boolean;
  generatedAt: string;
}

export type GuidanceErrorCode =
  | "ai_disabled"
  | "budget_exhausted"
  | "rate_limited"
  | "invalid_request"
  | "upstream_failed"
  | "invalid_model_output"
  | "timeout";

export interface GuidanceError {
  error: GuidanceErrorCode;
  message: string;
  retryable: boolean;
}
