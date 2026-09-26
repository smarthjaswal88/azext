import { NextResponse } from "next/server";
import { CATALOG_CACHE_HEADERS, catalogErrorResponse, listCatalogCategories } from "@/server/catalog-db";

/** GET /api/catalog/categories — every category present in the Supabase
 *  catalog, with product counts, product types, brands and price range. */
export async function GET() {
  try {
    const body = await listCatalogCategories();
    return NextResponse.json(body, { headers: CATALOG_CACHE_HEADERS });
  } catch (cause) {
    return catalogErrorResponse(cause);
  }
}
