import { NextResponse, type NextRequest } from "next/server";
import { CATALOG_CACHE_HEADERS, catalogErrorResponse, getCatalogProduct } from "@/server/catalog-db";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** GET /api/catalog/products/[slug] — one product with its variants,
 *  specifications and feature bullets, from Supabase only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const notFound = () =>
    NextResponse.json(
      { error: "not_found", message: "No product has that slug." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );

  if (slug.length > 120 || !SLUG.test(slug)) return notFound();

  try {
    const product = await getCatalogProduct(slug);
    if (!product) return notFound();
    return NextResponse.json({ product }, { headers: CATALOG_CACHE_HEADERS });
  } catch (cause) {
    return catalogErrorResponse(cause);
  }
}
