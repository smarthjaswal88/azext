import { NextResponse, type NextRequest } from "next/server";
import { parseCatalogProductQuery } from "@/lib/catalog-api";
import { CATALOG_CACHE_HEADERS, catalogErrorResponse, listCatalogProducts } from "@/server/catalog-db";

/**
 * GET /api/catalog/products
 *
 *   q         full-text search over title, brand and description (max 100 chars)
 *   category  exact category id, e.g. headphones
 *   brand     exact brand name, as listed by /api/catalog/categories
 *   minPrice  integer cents, inclusive
 *   maxPrice  integer cents, inclusive
 *   sort      featured (most rated) | price-asc | price-desc | rating-desc
 *   limit     1–48, default 24
 *   offset    0–10000, default 0
 *
 * Reads Supabase only. Malformed parameters are a 400 with the reasons.
 */
export async function GET(request: NextRequest) {
  const parsed = parseCatalogProductQuery(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "invalid_query", message: "Some query parameters are not valid.", issues: parsed.issues },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const body = await listCatalogProducts(parsed.query);
    return NextResponse.json(body, { headers: CATALOG_CACHE_HEADERS });
  } catch (cause) {
    return catalogErrorResponse(cause);
  }
}
