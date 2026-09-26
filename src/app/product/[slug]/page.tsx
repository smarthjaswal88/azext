import { notFound } from "next/navigation";
import { cache } from "react";
import { ProductDetail, ProductView } from "@/components/product/product-detail";
import { SiteHeader } from "@/components/site-header";
import type { CatalogProductDetail } from "@/lib/catalog-api";
import { CATALOG_SLUG, CatalogReadError, getCatalogProduct } from "@/server/catalog-db";

type Lookup =
  | { status: "found"; product: CatalogProductDetail }
  | { status: "missing" }
  | { status: "unavailable" };

/**
 * One Supabase read per request, shared by the metadata and the page. It is
 * the same lookup that backs GET /api/catalog/products/[slug].
 */
const lookup = cache(async (slug: string): Promise<Lookup> => {
  if (slug.length > 120 || !CATALOG_SLUG.test(slug)) return { status: "missing" };
  try {
    const product = await getCatalogProduct(slug);
    return product ? { status: "found", product } : { status: "missing" };
  } catch (cause) {
    if (cause instanceof CatalogReadError) return { status: "unavailable" };
    throw cause;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await lookup(slug);
  return {
    title:
      result.status === "found" ? result.product.title : result.status === "missing" ? "Product not found" : "Product",
  };
}

/**
 * An unknown slug is a real 404. A known product is rendered from the server
 * lookup. If the catalog cannot be read right now, the page falls back to
 * loading in the browser, which shows an error with a retry rather than
 * claiming the product does not exist.
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await lookup(slug);
  if (result.status === "missing") notFound();

  return (
    <>
      <SiteHeader />
      <main id="main" className="container-app flex-1 pb-20">
        {result.status === "found" ? (
          <ProductView key={result.product.id} product={result.product} />
        ) : (
          <ProductDetail slug={slug} />
        )}
      </main>
    </>
  );
}
