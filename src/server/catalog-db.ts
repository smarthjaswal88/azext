/**
 * Supabase reads for the /api/catalog routes.
 *
 * Supabase is the only source: there is no fallback to the static demo
 * catalog. When Supabase is unconfigured or the catalog migration has not been
 * applied, callers get a CatalogReadError saying so, never stand-in data.
 *
 * The catalog tables have RLS on and no policies, like the orders tables, so
 * these reads use the server-only secret-key client. Only named columns are
 * selected, and rows are mapped into the public API shapes in
 * src/lib/catalog-api.ts before leaving this module.
 */

import { NextResponse } from "next/server";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  catalogCategoryLabel,
  catalogProductTypeLabel,
  type CatalogAvailability,
  type CatalogCategoriesResponse,
  type CatalogCategory,
  type CatalogErrorCode,
  type CatalogProductDetail,
  type CatalogProductListResponse,
  type CatalogProductQuery,
  type CatalogProductSummary,
  type CatalogSource,
  type CatalogVariant,
} from "@/lib/catalog-api";
import { getServiceClient } from "./supabase";

export class CatalogReadError extends Error {
  constructor(readonly code: Exclude<CatalogErrorCode, "invalid_query" | "not_found">) {
    super(`Catalog read failed: ${code}`);
    this.name = "CatalogReadError";
  }
}

const SUMMARY_COLUMNS =
  "id, slug, title, brand, category, product_type, price_cents, list_price_cents, currency, " +
  "rating, rating_count, availability, image_url, source, source_url, fetched_at, updated_at";

const DETAIL_COLUMNS =
  `${SUMMARY_COLUMNS}, description, availability_text, source_categories, ` +
  "catalog_variants (id, source_variant_id, label, options, price_cents, currency, availability, is_default, position), " +
  "catalog_specifications (kind, label, value, position)";

interface ProductRow {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  category: string;
  product_type: string;
  price_cents: number;
  list_price_cents: number | null;
  currency: string;
  rating: number | string | null;
  rating_count: number | null;
  availability: CatalogAvailability;
  image_url: string | null;
  source: CatalogSource;
  source_url: string;
  fetched_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  source_variant_id: string;
  label: string | null;
  options: Record<string, string> | null;
  price_cents: number | null;
  currency: string | null;
  availability: CatalogAvailability;
  is_default: boolean;
  position: number;
}

interface SpecificationRow {
  kind: "specification" | "feature";
  label: string | null;
  value: string;
  position: number;
}

interface DetailRow extends ProductRow {
  description: string | null;
  availability_text: string | null;
  source_categories: string[] | null;
  catalog_variants: VariantRow[] | null;
  catalog_specifications: SpecificationRow[] | null;
}

function client(): SupabaseClient {
  let supabase: SupabaseClient | undefined;
  try {
    supabase = getServiceClient();
  } catch {
    // createClient throws on a malformed URL: unconfigured, not a crash.
    supabase = undefined;
  }
  if (!supabase) throw new CatalogReadError("catalog_unconfigured");
  return supabase;
}

function fail(error: PostgrestError): never {
  const missing = error.code === "PGRST205" || error.code === "PGRST200" || error.code === "42P01";
  console.warn(`[catalog] query failed: ${error.code || "unknown error"}`);
  throw new CatalogReadError(missing ? "catalog_not_migrated" : "catalog_query_failed");
}

function toSummary(row: ProductRow): CatalogProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    brand: row.brand,
    category: row.category,
    productType: row.product_type,
    priceCents: row.price_cents,
    listPriceCents: row.list_price_cents,
    currency: row.currency,
    // numeric arrives as a number or, for some drivers, a string.
    rating: row.rating === null ? null : Number(row.rating),
    ratingCount: row.rating_count,
    availability: row.availability,
    imageUrl: row.image_url,
    source: row.source,
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

/** The part of the PostgREST builder the filters use. Deliberately narrow:
 *  the untyped client's generics are too deep for TypeScript to thread
 *  through a helper, and these four methods are all that is needed. */
interface Filterable {
  textSearch(column: string, query: string, options: { type: "websearch"; config: string }): Filterable;
  eq(column: string, value: string): Filterable;
  gte(column: string, value: number): Filterable;
  lte(column: string, value: number): Filterable;
}

/** Filters shared by the page query and the count-only fallback below. */
function applyFilters<T>(builder: T, query: CatalogProductQuery): T {
  let filtered = builder as unknown as Filterable;
  // websearch_to_tsquery accepts any input without syntax errors; every term
  // must match, so extra words narrow the results.
  if (query.q) filtered = filtered.textSearch("search_vector", query.q, { type: "websearch", config: "english" });
  if (query.category) filtered = filtered.eq("category", query.category);
  if (query.brand) filtered = filtered.eq("brand", query.brand);
  if (query.minPriceCents !== undefined) filtered = filtered.gte("price_cents", query.minPriceCents);
  if (query.maxPriceCents !== undefined) filtered = filtered.lte("price_cents", query.maxPriceCents);
  return filtered as unknown as T;
}

export async function listCatalogProducts(
  query: CatalogProductQuery,
): Promise<CatalogProductListResponse> {
  const supabase = client();
  let request = applyFilters(
    supabase.from("catalog_products").select(SUMMARY_COLUMNS, { count: "exact" }),
    query,
  );

  const nullsLast = { nullsFirst: false } as const;
  switch (query.sort) {
    case "price-asc":
      request = request.order("price_cents", { ascending: true });
      break;
    case "price-desc":
      request = request.order("price_cents", { ascending: false });
      break;
    case "rating-desc":
      request = request
        .order("rating", { ascending: false, ...nullsLast })
        .order("rating_count", { ascending: false, ...nullsLast });
      break;
    case "featured":
    default:
      // Most rated first — named for what it does, as in the existing listing.
      request = request
        .order("rating_count", { ascending: false, ...nullsLast })
        .order("rating", { ascending: false, ...nullsLast });
  }
  // A stable tiebreaker, so paging never repeats or skips a product.
  request = request.order("slug", { ascending: true });

  const { data, error, count } = await request.range(query.offset, query.offset + query.limit - 1);

  if (error) {
    // PostgREST refuses a range that starts past the last row. That is an
    // empty page, not a failure; the total still comes from a count.
    if (error.code === "PGRST103") {
      const counted = await applyFilters(
        supabase.from("catalog_products").select("id", { count: "exact", head: true }),
        query,
      );
      if (counted.error) fail(counted.error);
      return { products: [], total: counted.count ?? 0, limit: query.limit, offset: query.offset, query };
    }
    fail(error);
  }

  return {
    products: ((data ?? []) as unknown as ProductRow[]).map(toSummary),
    total: count ?? 0,
    limit: query.limit,
    offset: query.offset,
    query,
  };
}

function toDetail(row: DetailRow): CatalogProductDetail {
  const specifications = [...(row.catalog_specifications ?? [])].sort((a, b) => a.position - b.position);
  const variants: CatalogVariant[] = [...(row.catalog_variants ?? [])]
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.position - b.position)
    .map((variant) => ({
      id: variant.id,
      sourceVariantId: variant.source_variant_id,
      label: variant.label,
      options: variant.options ?? {},
      priceCents: variant.price_cents,
      currency: variant.currency,
      availability: variant.availability,
      isDefault: variant.is_default,
    }));

  return {
    ...toSummary(row),
    description: row.description,
    availabilityText: row.availability_text,
    sourceCategories: row.source_categories ?? [],
    specifications: specifications
      .filter((spec) => spec.kind === "specification" && spec.label)
      .map((spec) => ({ label: spec.label as string, value: spec.value })),
    features: specifications.filter((spec) => spec.kind === "feature").map((spec) => spec.value),
    variants,
  };
}

export async function getCatalogProduct(slug: string): Promise<CatalogProductDetail | undefined> {
  const { data, error } = await client()
    .from("catalog_products")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return undefined;
  return toDetail(data as unknown as DetailRow);
}

export const CATALOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRODUCT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Several products by slug or id, in the order asked for, each at most once.
 * Anything that is neither a slug nor an id, or does not exist, is simply
 * absent — the caller compares counts to find out.
 */
export async function getCatalogProductsByIdentifiers(identifiers: string[]): Promise<CatalogProductDetail[]> {
  const ids = [...new Set(identifiers.filter((i) => PRODUCT_ID.test(i)).map((i) => i.toLowerCase()))];
  const slugs = [...new Set(identifiers.filter((i) => !PRODUCT_ID.test(i) && i.length <= 120 && CATALOG_SLUG.test(i)))];

  const rows: DetailRow[] = [];
  for (const [column, values] of [["id", ids], ["slug", slugs]] as const) {
    if (values.length === 0) continue;
    const { data, error } = await client().from("catalog_products").select(DETAIL_COLUMNS).in(column, values);
    if (error) fail(error);
    rows.push(...((data ?? []) as unknown as DetailRow[]));
  }

  const out: CatalogProductDetail[] = [];
  for (const identifier of identifiers) {
    const key = identifier.toLowerCase();
    const row = rows.find((r) => r.id === key || r.slug === identifier);
    if (row && !out.some((p) => p.id === row.id)) out.push(toDetail(row));
  }
  return out;
}

/** Aggregated in code: the catalog is small (tens of rows) and bounded here. */
const CATEGORY_SCAN_LIMIT = 5_000;

export async function listCatalogCategories(): Promise<CatalogCategoriesResponse> {
  const { data, error } = await client()
    .from("catalog_products")
    .select("category, product_type, brand, price_cents")
    .limit(CATEGORY_SCAN_LIMIT);
  if (error) fail(error);

  const rows = (data ?? []) as unknown as {
    category: string;
    product_type: string;
    brand: string | null;
    price_cents: number;
  }[];

  const byCategory = new Map<
    string,
    { count: number; types: Map<string, number>; brands: Set<string>; min: number; max: number }
  >();
  for (const row of rows) {
    const entry = byCategory.get(row.category) ?? {
      count: 0,
      types: new Map<string, number>(),
      brands: new Set<string>(),
      min: row.price_cents,
      max: row.price_cents,
    };
    entry.count += 1;
    entry.types.set(row.product_type, (entry.types.get(row.product_type) ?? 0) + 1);
    if (row.brand) entry.brands.add(row.brand);
    entry.min = Math.min(entry.min, row.price_cents);
    entry.max = Math.max(entry.max, row.price_cents);
    byCategory.set(row.category, entry);
  }

  const categories: CatalogCategory[] = [...byCategory.entries()]
    .map(([id, entry]) => ({
      id,
      label: catalogCategoryLabel(id),
      productCount: entry.count,
      productTypes: [...entry.types.entries()]
        .map(([typeId, productCount]) => ({ id: typeId, label: catalogProductTypeLabel(typeId), productCount }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      brands: [...entry.brands].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
      priceRangeCents: { min: entry.min, max: entry.max },
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { categories, totalProducts: rows.length };
}

// ---------------------------------------------------------------------------
// pricing
// ---------------------------------------------------------------------------

/** What checkout pricing needs to know about one variant, read from Supabase. */
export interface PricingVariant {
  variantId: string;
  productSlug: string;
  title: string;
  brand: string;
  /** e.g. "Black Beats Studio Pro"; empty when the listing has no options. */
  optionsLabel: string;
  /** Remote URL on the source's image CDN, or "" when there is none. */
  imageSrc: string;
  imageAlt: string;
  /** Null when the source gave this option no price. */
  priceCents: number | null;
  listPriceCents?: number;
  /** Priced in USD and not reported out of stock. */
  available: boolean;
}

const VARIANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PricingRow {
  id: string;
  label: string | null;
  options: Record<string, string> | null;
  price_cents: number | null;
  currency: string | null;
  availability: CatalogAvailability;
  is_default: boolean;
  catalog_products: {
    slug: string;
    title: string;
    brand: string | null;
    image_url: string | null;
    list_price_cents: number | null;
  } | null;
}

/**
 * Resolves variant ids to what pricing needs, in one query. Ids that are not
 * catalog variant ids are simply absent from the result, which pricing reports
 * as an unknown option. Nothing here trusts the caller about price: every
 * number comes from the stored catalog row.
 */
export async function getVariantsForPricing(
  variantIds: string[],
): Promise<Map<string, PricingVariant>> {
  const ids = [...new Set(variantIds.filter((id) => VARIANT_ID.test(id)).map((id) => id.toLowerCase()))];
  const found = new Map<string, PricingVariant>();
  if (ids.length === 0) return found;

  const { data, error } = await client()
    .from("catalog_variants")
    .select(
      "id, label, options, price_cents, currency, availability, is_default, " +
        "catalog_products!inner (slug, title, brand, image_url, list_price_cents)",
    )
    .in("id", ids);
  if (error) fail(error);

  for (const row of (data ?? []) as unknown as PricingRow[]) {
    const product = row.catalog_products;
    if (!product) continue;
    const priced = row.price_cents !== null && row.currency === "USD";
    const optionsLabel =
      row.label ?? Object.values(row.options ?? {}).filter(Boolean).join(" · ");
    found.set(row.id, {
      variantId: row.id,
      productSlug: product.slug,
      title: product.title,
      brand: product.brand ?? "",
      optionsLabel,
      imageSrc: product.image_url ?? "",
      imageAlt: product.title,
      priceCents: priced ? row.price_cents : null,
      // The was-price belongs to the listing itself, i.e. its default option.
      listPriceCents: row.is_default && product.list_price_cents !== null ? product.list_price_cents : undefined,
      available: priced && row.availability !== "out_of_stock",
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// responses
// ---------------------------------------------------------------------------

/** Public catalog data changes only on import, so a short shared cache is safe. */
export const CATALOG_CACHE_HEADERS = {
  "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
};

const ERROR_MESSAGES: Record<CatalogReadError["code"], string> = {
  catalog_unconfigured: "The catalog is not available right now.",
  catalog_not_migrated: "The catalog has not been set up yet.",
  catalog_query_failed: "The catalog could not be read.",
};

export function catalogErrorResponse(cause: unknown) {
  if (cause instanceof CatalogReadError) {
    return NextResponse.json(
      { error: cause.code, message: ERROR_MESSAGES[cause.code] },
      { status: cause.code === "catalog_query_failed" ? 502 : 503, headers: { "cache-control": "no-store" } },
    );
  }
  console.error(`[catalog] unexpected failure: ${cause instanceof Error ? cause.name : "unknown"}`);
  return NextResponse.json(
    { error: "catalog_query_failed", message: ERROR_MESSAGES.catalog_query_failed },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}
