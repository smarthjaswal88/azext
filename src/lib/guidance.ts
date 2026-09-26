/**
 * Contract between /api/guidance and the Decision assistant panel.
 *
 * The assistant compares up to three live catalog products against a need the
 * shopper writes in plain text. Every product fact comes from the Supabase
 * catalog on the server; confidence is computed on the server from fixed rules
 * (src/server/ai/confidence.ts) and is never produced by the model.
 */

export const MIN_NEED_CHARS = 3;
export const MAX_NEED_CHARS = 280;
export const MAX_GUIDANCE_PRODUCTS = 3;

/** Shown beside every recommendation and returned with every result. */
export const GUIDANCE_TRANSPARENCY_NOTE =
  "Recommendation based on available catalog details, rating, and rating count. Individual customer review text was not imported.";

export interface GuidanceRequest {
  /** What matters to the shopper, in their words. */
  need: string;
  /** Live catalog product slugs or ids, 1 to 3, from one category. */
  products: string[];
}

export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * The thresholds behind the confidence level, shared by the server rules and
 * the explanation the panel shows, so the two cannot drift apart.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Distinct listing fields cited in support of the recommended product. */
  highMinFields: 3,
  mediumMinFields: 1,
  /** Ratings on the recommended product. */
  highMinRatings: 1000,
  mediumMinRatings: 50,
  /** A listing with fewer specifications and fewer features than this is thin. */
  minDetails: 3,
  /** Products within this price ratio and rating gap, of one type, are too similar. */
  similarPriceRatio: 0.05,
  similarRatingGap: 0.1,
} as const;

export const CONFIDENCE_RULES: readonly string[] = [
  `High: at least ${CONFIDENCE_THRESHOLDS.highMinFields} distinct listing fields support the recommendation, it has at least ${CONFIDENCE_THRESHOLDS.highMinRatings.toLocaleString("en-US")} ratings, and every part of the need is covered by a listing field.`,
  `Medium: at least ${CONFIDENCE_THRESHOLDS.mediumMinFields} supporting field and at least ${CONFIDENCE_THRESHOLDS.mediumMinRatings} ratings, but not enough for High.`,
  "Low: no recommendation, thin listing detail, products too similar to separate, a price above the stated budget, or too little evidence.",
];

export interface GuidanceConfidence {
  level: ConfidenceLevel;
  label: string;
  /** The rule outcomes that decided the level, in plain words. */
  reasons: string[];
}

export interface GuidanceEvidence {
  slug: string;
  productTitle: string;
  /** The field reference, e.g. "price", "spec:Item Weight", "feature:3". */
  field: string;
  /** Human label for the field, e.g. "Specification · Item Weight". */
  label: string;
  /** The field's live catalog value — looked up on the server, never taken from the model. */
  value: string;
  /** The assistant's note on how this field bears on the need. */
  note: string;
}

export interface GuidanceBudgetCheck {
  /** The ceiling found in the need text, parsed in code. */
  limitCents: number;
  products: { slug: string; priceCents: number; withinBudget: boolean }[];
}

export interface GuidanceResult {
  model: string;
  /** Echoed so the panel can tell a response apart from a stale one. */
  requestId: string;
  cached: boolean;
  generatedAt: string;
  need: string;
  compared: { slug: string; title: string; brand: string | null }[];
  recommendation: {
    /** null is a valid answer: no clear recommendation. */
    slug: string | null;
    title: string | null;
    reason: string;
  };
  evidence: GuidanceEvidence[];
  tradeoffs: string[];
  /** Parts of the need no listing field addresses. */
  unaddressed: string[];
  confidence: GuidanceConfidence;
  budget: GuidanceBudgetCheck | null;
  /** Always GUIDANCE_TRANSPARENCY_NOTE. */
  limitation: string;
}

export type GuidanceErrorCode =
  | "ai_disabled"
  | "budget_exhausted"
  | "rate_limited"
  | "duplicate_in_flight"
  | "invalid_request"
  | "unknown_product"
  | "catalog_unavailable"
  | "upstream_failed"
  | "invalid_model_output"
  | "timeout";

export interface GuidanceError {
  error: GuidanceErrorCode;
  message: string;
  retryable: boolean;
}

/** GET /api/guidance. A boolean only — never which requirement is missing. */
export interface GuidanceAvailability {
  available: boolean;
}
