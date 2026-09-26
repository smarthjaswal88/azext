/**
 * Discovery filter state, kept in the URL so every view is shareable and the
 * back button steps through changes (the page writes it with the History API).
 *
 * Text, category, brand, price and sort go to the catalog API. Product type
 * and minimum rating are not API parameters, so they are applied in the
 * browser over the full result set (see fetchAllProducts).
 */

import type { CatalogProductSummary } from "./catalog-api";
import type { ProductQueryParams } from "./catalog-client";
import { parseDollarsToCents } from "./format";
import { SORT_OPTIONS } from "./sort";
import type { SortKey } from "./types";

export const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4.0 and up" },
  { value: "4.5", label: "4.5 and up" },
] as const;

export type RatingFilter = (typeof RATING_OPTIONS)[number]["value"];

export interface DiscoveryFilters {
  q: string;
  category: string;
  type: string;
  brand: string;
  /** Dollars, as typed. */
  min: string;
  max: string;
  rating: RatingFilter;
  sort: SortKey;
}

export const EMPTY_FILTERS: DiscoveryFilters = {
  q: "",
  category: "",
  type: "",
  brand: "",
  min: "",
  max: "",
  rating: "",
  sort: "featured",
};

const ID = /^[a-z0-9_-]{1,40}$/;
const DOLLARS = /^\d{1,7}(\.\d{1,2})?$/;

/** The catalog API's price ceiling (MAX_PRICE_CENTS in catalog-api.ts), in
 *  dollars. A larger bound would be refused, so it is never sent. */
export const MAX_FILTER_DOLLARS = 1_000_000;

/** Whether a typed price is in the form the URL keeps, e.g. "25" or "25.50",
 *  and within what the catalog API accepts. */
export function isDollarAmount(value: string): boolean {
  return DOLLARS.test(value) && Number(value) <= MAX_FILTER_DOLLARS;
}

function clean(value: string | null, max: number): string {
  const text = (value ?? "").replace(/\p{Cc}/gu, "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

export function parseFilters(params: URLSearchParams): DiscoveryFilters {
  const category = clean(params.get("category"), 40);
  const type = clean(params.get("type"), 40);
  const min = clean(params.get("min"), 10);
  const max = clean(params.get("max"), 10);
  const rating = clean(params.get("rating"), 4);
  const sort = clean(params.get("sort"), 20);
  return {
    q: clean(params.get("q"), 100),
    category: ID.test(category) ? category : "",
    type: ID.test(type) ? type : "",
    brand: clean(params.get("brand"), 120),
    min: isDollarAmount(min) ? min : "",
    max: isDollarAmount(max) ? max : "",
    rating: RATING_OPTIONS.some((o) => o.value === rating) ? (rating as RatingFilter) : "",
    sort: (SORT_OPTIONS.find((o) => o.key === sort)?.key ?? "featured") as SortKey,
  };
}

export function serializeFilters(filters: DiscoveryFilters): string {
  const sp = new URLSearchParams();
  for (const key of ["q", "category", "type", "brand", "min", "max", "rating"] as const) {
    if (filters[key]) sp.set(key, filters[key]);
  }
  if (filters.sort !== "featured") sp.set("sort", filters.sort);
  return sp.toString();
}

export function activeFilterCount(filters: DiscoveryFilters): number {
  return (["q", "category", "type", "brand", "min", "max", "rating"] as const).filter((k) => filters[k]).length;
}

export interface PriceRange {
  minPriceCents?: number;
  maxPriceCents?: number;
  /** Set when the typed range cannot be applied. */
  problem?: string;
}

export function priceRange(filters: DiscoveryFilters): PriceRange {
  const minPriceCents = parseDollarsToCents(filters.min);
  const maxPriceCents = parseDollarsToCents(filters.max);
  if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
    return { problem: "The minimum price is above the maximum, so no price filter is applied." };
  }
  return { minPriceCents, maxPriceCents };
}

/** The part of the filters the catalog API applies. */
export function apiQuery(filters: DiscoveryFilters): Omit<ProductQueryParams, "limit" | "offset"> {
  const { minPriceCents, maxPriceCents } = priceRange(filters);
  return {
    q: filters.q || undefined,
    category: filters.category || undefined,
    brand: filters.brand || undefined,
    minPriceCents,
    maxPriceCents,
    sort: filters.sort,
  };
}

/** The part applied here, over the API's results. */
export function applyLocalFilters(
  products: CatalogProductSummary[],
  filters: DiscoveryFilters,
): CatalogProductSummary[] {
  const minimum = filters.rating ? Number(filters.rating) : undefined;
  return products.filter(
    (p) =>
      (!filters.type || p.productType === filters.type) &&
      (minimum === undefined || (p.rating !== null && p.rating >= minimum)),
  );
}
