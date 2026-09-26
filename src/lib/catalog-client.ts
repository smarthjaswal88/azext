/**
 * Browser client for the live catalog API. The frontend reads catalog data
 * through these three routes and nothing else:
 *
 *   GET /api/catalog/products          filtered, sorted, paged summaries
 *   GET /api/catalog/products/[slug]   one product with variants and specs
 *   GET /api/catalog/categories        categories, types, brands, price ranges
 *
 * There is no fallback data: a failed request is reported as a failure.
 */

import type {
  CatalogCategoriesResponse,
  CatalogErrorResponse,
  CatalogProductDetail,
  CatalogProductListResponse,
  CatalogProductSummary,
} from "./catalog-api";
import type { SortKey } from "./types";

export class CatalogRequestError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never completed. */
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CatalogRequestError";
  }
}

export function isAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { accept: "application/json" } });
  } catch (cause) {
    if (isAbort(cause)) throw cause;
    throw new CatalogRequestError(0, "network_error", "The catalog could not be reached.");
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = body as Partial<CatalogErrorResponse> | undefined;
    throw new CatalogRequestError(
      response.status,
      error?.error ?? "request_failed",
      error?.message ?? `The catalog request failed (${response.status}).`,
    );
  }
  return body as T;
}

export interface ProductQueryParams {
  q?: string;
  category?: string;
  brand?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

/** The API's own parameter names; prices are integer cents. */
export function productsPath(params: ProductQueryParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.brand) sp.set("brand", params.brand);
  if (params.minPriceCents !== undefined) sp.set("minPrice", String(params.minPriceCents));
  if (params.maxPriceCents !== undefined) sp.set("maxPrice", String(params.maxPriceCents));
  if (params.sort) sp.set("sort", params.sort);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  if (params.offset !== undefined) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return qs ? `/api/catalog/products?${qs}` : "/api/catalog/products";
}

export function fetchCategories(signal?: AbortSignal) {
  return getJson<CatalogCategoriesResponse>("/api/catalog/categories", signal);
}

export function fetchProductPage(params: ProductQueryParams, signal?: AbortSignal) {
  return getJson<CatalogProductListResponse>(productsPath(params), signal);
}

export async function fetchProduct(slug: string, signal?: AbortSignal): Promise<CatalogProductDetail> {
  const { product } = await getJson<{ product: CatalogProductDetail }>(
    `/api/catalog/products/${encodeURIComponent(slug)}`,
    signal,
  );
  return product;
}

/** The API's page size ceiling. */
const PAGE_SIZE = 48;

export interface ProductCollection {
  products: CatalogProductSummary[];
  /** Matches reported by the API for the server-side filters. */
  total: number;
  /** True when more matches exist than were loaded. */
  truncated: boolean;
}

/**
 * Every page of a query, up to `maxPages`. The catalog API filters by text,
 * category, brand and price; product type and rating are applied by the
 * caller over the complete result, which is why the whole set is loaded.
 */
export async function fetchAllProducts(
  params: Omit<ProductQueryParams, "limit" | "offset">,
  signal?: AbortSignal,
  maxPages = 6,
): Promise<ProductCollection> {
  const products: CatalogProductSummary[] = [];
  let total = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchProductPage({ ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE }, signal);
    total = result.total;
    products.push(...result.products);
    if (products.length >= total || result.products.length === 0) break;
  }
  return { products, total, truncated: products.length < total };
}
