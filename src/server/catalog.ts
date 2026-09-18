/**
 * The only way the app reads catalog data.
 *
 * Today it reads the in-memory demo catalog in ./demo-data.ts. When Supabase
 * arrives, these function bodies change and nothing that calls them does. The
 * functions are deliberately specific to what the storefront asks for — this is
 * not a generic repository or query builder, and it should not grow into one.
 *
 * Every function is async so that swapping in a real client does not change a
 * single call site.
 */

import type {
  Category,
  CategoryId,
  ComparisonGroupId,
  Product,
  SearchQuery,
  SortKey,
  Variant,
} from "@/lib/types";
import { fromPriceCents } from "@/lib/product";
import { DEMO_PRODUCTS } from "./demo-data";

/** Bumped whenever the demo catalog changes. Part of the AI cache key, so a
 *  price or review edit invalidates previously cached guidance instead of
 *  serving advice about a product that no longer exists in that form. */
export const CATALOG_VERSION = "2026-09-18.1";

const CATEGORIES: Category[] = [
  {
    id: "headphones",
    name: "Headphones",
    slug: "headphones",
    blurb: "Over-ear, on-ear and true wireless, from commuter pairs to open-back reference.",
  },
  {
    id: "clothing",
    name: "Clothing",
    slug: "clothing",
    blurb: "Everyday shirts, knitwear and trousers in natural fabrics, sized XS to XXL.",
  },
];

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getCategory(id: CategoryId): Promise<Category | undefined> {
  return CATEGORIES.find((c) => c.id === id);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return DEMO_PRODUCTS.find((p) => p.slug === slug);
}

/** Highest-rated products in a category, for the homepage rows. */
export async function getFeaturedProducts(
  category: CategoryId,
  limit: number,
): Promise<Product[]> {
  return DEMO_PRODUCTS.filter((p) => p.category === category)
    .slice()
    .sort((a, b) => b.rating.average - a.rating.average)
    .slice(0, limit);
}

/** A spec whose value says the feature is absent must not make the product
 *  match that feature's name — otherwise searching "noise cancelling" returns
 *  every pair of headphones, including the ones that plainly say "None". */
function specIsAbsent(value: string): boolean {
  return /^(none|not applicable)\b/i.test(value.trim());
}

/** Free-text match across the fields a shopper would reasonably expect to
 *  search: title, brand, summary and specifications. Every whitespace separated
 *  term must appear somewhere, so extra words narrow rather than widen the
 *  result set. */
function matchesText(product: Product, q: string): boolean {
  const haystack = [
    product.title,
    product.brand,
    product.summary,
    product.category,
    ...product.specs
      .filter((s) => !specIsAbsent(s.value))
      .map((s) => `${s.label} ${s.value}`),
  ]
    .join(" ")
    .toLowerCase();
  // Word-boundary matching, not raw substring: "open" should find "open-back"
  // but not "leg opening". Terms are AND-ed, so extra words narrow the results.
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => new RegExp(`\\b${escapeRegExp(term)}`, "i").test(haystack));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortProducts(products: Product[], sort: SortKey): Product[] {
  const out = products.slice();
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => fromPriceCents(a) - fromPriceCents(b));
    case "price-desc":
      return out.sort((a, b) => fromPriceCents(b) - fromPriceCents(a));
    case "rating-desc":
      return out.sort(
        (a, b) =>
          b.rating.average - a.rating.average || b.rating.ratingCount - a.rating.ratingCount,
      );
    case "featured":
    default:
      // Most rated first. Named for what it does rather than implying we have
      // a merchandised ordering, which we do not.
      return out.sort((a, b) => b.rating.ratingCount - a.rating.ratingCount);
  }
}

export async function searchProducts(query: SearchQuery): Promise<Product[]> {
  let results = DEMO_PRODUCTS.slice();

  if (query.q) {
    results = results.filter((p) => matchesText(p, query.q as string));
  }
  if (query.category) {
    results = results.filter((p) => p.category === query.category);
  }
  // A product matches a price filter when any of its variants falls in range,
  // since the shopper can pick that variant.
  if (query.minPriceCents !== undefined) {
    const min = query.minPriceCents;
    results = results.filter((p) => p.variants.some((v) => v.priceCents >= min));
  }
  if (query.maxPriceCents !== undefined) {
    const max = query.maxPriceCents;
    results = results.filter((p) => p.variants.some((v) => v.priceCents <= max));
  }

  return sortProducts(results, query.sort);
}

/** Counts for every group in one pass, for pages rendering a grid of cards. */
export async function getComparisonGroupCounts(): Promise<
  Record<ComparisonGroupId, number>
> {
  const counts = {
    "personal-audio": 0,
    "shirts-and-tops": 0,
    "knitwear-and-layers": 0,
    trousers: 0,
  } as Record<ComparisonGroupId, number>;
  for (const product of DEMO_PRODUCTS) counts[product.comparisonGroup] += 1;
  return counts;
}

/** How many products share a group. The selection control needs this to say
 *  "there is nothing else here to compare against" rather than offering a
 *  comparison that can never reach two columns. */
export async function countProductsInComparisonGroup(
  group: ComparisonGroupId,
): Promise<number> {
  return DEMO_PRODUCTS.filter((p) => p.comparisonGroup === group).length;
}

/** Resolves several slugs at once, preserving the order asked for and dropping
 *  anything unknown. Used by the comparison page and tray, which take slugs
 *  from the URL or from browser storage and must tolerate both being stale. */
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  const bySlug = new Map(DEMO_PRODUCTS.map((p) => [p.slug, p]));
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const product = bySlug.get(slug);
    if (product) out.push(product);
  }
  return out;
}

/** Resolves a variant id to the variant and the product that owns it. This is
 *  the lookup order pricing depends on: the browser sends variant ids and
 *  nothing else, and every price comes from here. */
export async function getVariantById(
  variantId: string,
): Promise<{ product: Product; variant: Variant } | undefined> {
  for (const product of DEMO_PRODUCTS) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return undefined;
}

/** Bounds for the price filter's placeholder text. */
export async function getPriceBounds(): Promise<{ minCents: number; maxCents: number }> {
  const prices = DEMO_PRODUCTS.flatMap((p) => p.variants.map((v) => v.priceCents));
  return { minCents: Math.min(...prices), maxCents: Math.max(...prices) };
}
