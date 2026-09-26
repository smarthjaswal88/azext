/**
 * Contract for the Supabase-backed catalog API (/api/catalog/*).
 *
 * Shapes and query parsing only — no data access, no server imports — so the
 * frontend can build requests and read responses against the same types the
 * routes produce. Money is integer cents throughout, as everywhere else.
 */

import type { SortKey } from "./types";
import { SORT_OPTIONS } from "./sort";

export type CatalogSource = "bright_data_amazon";

export type CatalogAvailability = "in_stock" | "limited_stock" | "out_of_stock" | "unknown";

export interface CatalogProductSummary {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  category: string;
  productType: string;
  priceCents: number;
  /** The source's was-price, only when higher than priceCents. */
  listPriceCents: number | null;
  currency: string;
  rating: number | null;
  ratingCount: number | null;
  availability: CatalogAvailability;
  /** A remote URL on the source's image CDN. Nothing is downloaded or stored. */
  imageUrl: string | null;
  source: CatalogSource;
  /** The product's page on the source site, without tracking parameters. */
  sourceUrl: string;
  fetchedAt: string;
  updatedAt: string;
}

export interface CatalogVariant {
  id: string;
  sourceVariantId: string;
  label: string | null;
  options: Record<string, string>;
  /** Null when the source did not give this option a price: not purchasable. */
  priceCents: number | null;
  currency: string | null;
  availability: CatalogAvailability;
  isDefault: boolean;
}

export interface CatalogSpecification {
  label: string;
  value: string;
}

export interface CatalogProductDetail extends CatalogProductSummary {
  description: string | null;
  availabilityText: string | null;
  sourceCategories: string[];
  specifications: CatalogSpecification[];
  /** The listing's bullet points, in source order. */
  features: string[];
  variants: CatalogVariant[];
}

export interface CatalogProductQuery {
  q?: string;
  category?: string;
  brand?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort: SortKey;
  limit: number;
  offset: number;
}

export interface CatalogProductListResponse {
  products: CatalogProductSummary[];
  /** Matches for the filters, ignoring limit and offset. */
  total: number;
  limit: number;
  offset: number;
  query: CatalogProductQuery;
}

export interface CatalogProductResponse {
  product: CatalogProductDetail;
}

export interface CatalogCategory {
  id: string;
  label: string;
  productCount: number;
  productTypes: { id: string; label: string; productCount: number }[];
  brands: string[];
  priceRangeCents: { min: number; max: number };
}

export interface CatalogCategoriesResponse {
  categories: CatalogCategory[];
  totalProducts: number;
}

export type CatalogErrorCode =
  | "invalid_query"
  | "not_found"
  | "catalog_unconfigured"
  | "catalog_not_migrated"
  | "catalog_query_failed";

export interface CatalogErrorResponse {
  error: CatalogErrorCode;
  message: string;
  issues?: string[];
}

// ---------------------------------------------------------------------------
// display labels
// ---------------------------------------------------------------------------

/** Display names for our own category and product-type ids. These label ids;
 *  they are not catalog data, which lives only in Supabase. */
export const CATALOG_CATEGORY_LABELS: Record<string, string> = {
  headphones: "Headphones",
  clothing: "Clothing",
};

export const CATALOG_PRODUCT_TYPE_LABELS: Record<string, string> = {
  wireless_headphones: "Wireless headphones",
  over_ear_headphones: "Over-ear headphones",
  t_shirt: "T-shirts",
  linen_shirt: "Linen shirts",
};

/** "t_shirt" -> "T shirt", for an id without a registered label. */
function humanize(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : id;
}

export function catalogCategoryLabel(id: string): string {
  return CATALOG_CATEGORY_LABELS[id] ?? humanize(id);
}

export function catalogProductTypeLabel(id: string): string {
  return CATALOG_PRODUCT_TYPE_LABELS[id] ?? humanize(id);
}

// ---------------------------------------------------------------------------
// query parsing
// ---------------------------------------------------------------------------

export const CATALOG_DEFAULT_LIMIT = 24;
export const CATALOG_MAX_LIMIT = 48;
export const CATALOG_MAX_OFFSET = 10_000;
/** $1,000,000 — far above anything in the catalog, low enough to rule out overflow. */
const MAX_PRICE_CENTS = 100_000_000;

const CATEGORY_PATTERN = /^[a-z0-9_-]{1,40}$/;
const WHOLE_NUMBER = /^\d{1,9}$/;
const CONTROL_CHARS = /\p{Cc}/u;

export type ParsedCatalogQuery =
  | { ok: true; query: CatalogProductQuery }
  | { ok: false; issues: string[] };

/**
 * Validates GET /api/catalog/products parameters. Anything malformed is
 * reported rather than silently dropped, so a caller never receives results
 * for a filter it did not ask for. Unknown parameters are ignored.
 *
 * minPrice and maxPrice are integer cents (maxPrice=15000 means $150.00),
 * matching how money is represented everywhere in this codebase.
 */
export function parseCatalogProductQuery(params: URLSearchParams): ParsedCatalogQuery {
  const issues: string[] = [];

  function single(name: string): string | undefined {
    const values = params.getAll(name);
    if (values.length > 1) {
      issues.push(`${name} may only be given once`);
      return undefined;
    }
    const value = values[0]?.trim();
    return value ? value : undefined;
  }

  function text(name: string, max: number): string | undefined {
    const value = single(name);
    if (value === undefined) return undefined;
    if (value.length > max) {
      issues.push(`${name} must be at most ${max} characters`);
      return undefined;
    }
    if (CONTROL_CHARS.test(value)) {
      issues.push(`${name} contains control characters`);
      return undefined;
    }
    return value;
  }

  function whole(name: string, min: number, max: number): number | undefined {
    const value = single(name);
    if (value === undefined) return undefined;
    if (!WHOLE_NUMBER.test(value)) {
      issues.push(`${name} must be a whole number`);
      return undefined;
    }
    const n = Number(value);
    if (n < min || n > max) {
      issues.push(`${name} must be between ${min} and ${max}`);
      return undefined;
    }
    return n;
  }

  const q = text("q", 100);

  const category = single("category");
  if (category !== undefined && !CATEGORY_PATTERN.test(category)) {
    issues.push("category must be lowercase letters, digits, - or _");
  }

  const brand = text("brand", 120);
  const minPriceCents = whole("minPrice", 0, MAX_PRICE_CENTS);
  const maxPriceCents = whole("maxPrice", 0, MAX_PRICE_CENTS);
  if (
    minPriceCents !== undefined &&
    maxPriceCents !== undefined &&
    minPriceCents > maxPriceCents
  ) {
    issues.push("minPrice must not be greater than maxPrice");
  }

  const rawSort = single("sort");
  const sort = SORT_OPTIONS.find((option) => option.key === rawSort)?.key;
  if (rawSort !== undefined && !sort) {
    issues.push(`sort must be one of ${SORT_OPTIONS.map((o) => o.key).join(", ")}`);
  }

  const limit = whole("limit", 1, CATALOG_MAX_LIMIT);
  const offset = whole("offset", 0, CATALOG_MAX_OFFSET);

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    query: {
      q,
      category,
      brand,
      minPriceCents,
      maxPriceCents,
      sort: sort ?? "featured",
      limit: limit ?? CATALOG_DEFAULT_LIMIT,
      offset: offset ?? 0,
    },
  };
}
