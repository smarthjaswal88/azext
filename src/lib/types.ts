/** Catalog domain types. Money is always integer cents in USD — never floats. */

export type CategoryId = "headphones" | "clothing";

/**
 * The set a product must share before it can be compared against another.
 *
 * Finer than category on purpose. "Clothing" is not a comparable set: a chino
 * and a t-shirt have almost no specification rows in common, so a table of them
 * is mostly "Not provided". These groups are chosen so the rows line up.
 */
export type ComparisonGroupId =
  | "personal-audio"
  | "shirts-and-tops"
  | "knitwear-and-layers"
  | "trousers";

export interface Category {
  id: CategoryId;
  name: string;
  slug: string;
  blurb: string;
}

/** The axes a product varies along. Headphones use colour only; clothing uses
 *  colour and size. Which axes exist is a property of the product, not the
 *  category, so a future product can differ without a schema change. */
export type OptionKey = "color" | "size";

export interface OptionAxis {
  key: OptionKey;
  label: string;
  /** Ordered — the UI renders values in this order. */
  values: OptionValue[];
}

export interface OptionValue {
  /** Stable within the product, e.g. "midnight" or "l". */
  id: string;
  label: string;
  /** Colour axes only: a swatch colour. */
  swatch?: string;
}

/** A purchasable combination. Every variant has a stable id, its own price and
 *  its own availability — price is per variant, not per product. */
export interface Variant {
  id: string;
  /** One entry per axis on the product, keyed by OptionValue.id. */
  options: Partial<Record<OptionKey, string>>;
  priceCents: number;
  /** Was-price for a strikethrough. Omitted when not discounted. */
  listPriceCents?: number;
  available: boolean;
}

export interface Spec {
  label: string;
  value: string;
}

export interface ProductImage {
  src: string;
  alt: string;
  /** Colour OptionValue.id this image depicts, when it is colour-specific. */
  colorId?: string;
}

/** Ratings and written reviews are counted separately: most people who rate a
 *  product never write anything, so reviewCount <= ratingCount. */
export interface RatingSummary {
  average: number;
  ratingCount: number;
  reviewCount: number;
  /** Counts per star, 5 down to 1. Sums to ratingCount. */
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** A review belongs to a product. It may name the variant that was bought,
 *  but is displayed on the product regardless of which variant is selected. */
export interface Review {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  /** Deliberately not a person's name — this is generated demo content. */
  authorLabel: string;
  createdAt: string;
  variantId?: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: CategoryId;
  /** Which products this one may be compared against. See ComparisonGroupId. */
  comparisonGroup: ComparisonGroupId;
  summary: string;
  images: ProductImage[];
  optionAxes: OptionAxis[];
  variants: Variant[];
  specs: Spec[];
  rating: RatingSummary;
  reviews: Review[];
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating-desc";

export interface SearchQuery {
  q?: string;
  category?: CategoryId;
  /** Inclusive bounds, in cents. */
  minPriceCents?: number;
  maxPriceCents?: number;
  sort: SortKey;
}
