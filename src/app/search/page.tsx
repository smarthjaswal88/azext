import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { formatPrice, parseDollarsToCents } from "@/lib/format";
import type { CategoryId, SortKey } from "@/lib/types";
import { getCategories, getPriceBounds, searchProducts } from "@/server/catalog";

export const metadata = { title: "Search" };

type RawParams = Record<string, string | string[] | undefined>;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Most rated" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "rating-desc", label: "Average rating" },
];

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}

/** Builds a link that keeps the current search state and changes one thing.
 *  Passing null drops a parameter, which is how "clear this filter" works. */
function hrefWith(params: RawParams, changes: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) sp.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const categories = await getCategories();
  const bounds = await getPriceBounds();

  const q = one(params, "q");
  const rawCategory = one(params, "category");
  const category = categories.some((c) => c.id === rawCategory)
    ? (rawCategory as CategoryId)
    : undefined;
  const rawSort = one(params, "sort");
  const sort = (SORTS.find((s) => s.key === rawSort)?.key ?? "featured") as SortKey;

  const minText = one(params, "min");
  const maxText = one(params, "max");
  const minPriceCents = parseDollarsToCents(minText);
  const maxPriceCents = parseDollarsToCents(maxText);

  const results = await searchProducts({ q, category, minPriceCents, maxPriceCents, sort });

  const activeCategory = categories.find((c) => c.id === category);
  const hasFilters = Boolean(q || category || minPriceCents !== undefined || maxPriceCents !== undefined);

  return (
    <>
      <SiteHeader defaultQuery={q ?? ""} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <div className="grid gap-6 lg:grid-cols-[236px_1fr]">
          {/* Filter rail. Category and sort are links; price is a small GET form.
              Everything lands in the URL, so results are shareable and the back
              button behaves. */}
          <aside className="space-y-6 lg:sticky lg:top-36 lg:self-start">
            <section>
              <h2 className="mb-2 text-sm font-semibold">Category</h2>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    href={hrefWith(params, { category: null })}
                    className={`block rounded px-2 py-1 hover:bg-surface-muted ${!category ? "font-semibold" : "text-muted-ink"}`}
                  >
                    All categories
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={hrefWith(params, { category: c.id })}
                      className={`block rounded px-2 py-1 hover:bg-surface-muted ${category === c.id ? "font-semibold" : "text-muted-ink"}`}
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold">Price</h2>
              <form action="/search" method="get" className="space-y-2">
                {q && <input type="hidden" name="q" value={q} />}
                {category && <input type="hidden" name="category" value={category} />}
                <input type="hidden" name="sort" value={sort} />
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="min-price">
                    Minimum price in dollars
                  </label>
                  <input
                    id="min-price"
                    name="min"
                    inputMode="decimal"
                    defaultValue={minText ?? ""}
                    placeholder={String(Math.floor(bounds.minCents / 100))}
                    className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-sm"
                  />
                  <span className="text-muted-ink">–</span>
                  <label className="sr-only" htmlFor="max-price">
                    Maximum price in dollars
                  </label>
                  <input
                    id="max-price"
                    name="max"
                    inputMode="decimal"
                    defaultValue={maxText ?? ""}
                    placeholder={String(Math.ceil(bounds.maxCents / 100))}
                    className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded border border-border-subtle bg-surface-muted px-3 py-1.5 text-sm font-medium hover:brightness-95"
                >
                  Apply
                </button>
              </form>
              <p className="mt-1 text-xs text-muted-ink">
                {formatPrice(bounds.minCents)} – {formatPrice(bounds.maxCents)} across the catalog
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold">Sort by</h2>
              <ul className="space-y-1 text-sm">
                {SORTS.map((s) => (
                  <li key={s.key}>
                    <Link
                      href={hrefWith(params, { sort: s.key })}
                      className={`block rounded px-2 py-1 hover:bg-surface-muted ${sort === s.key ? "font-semibold" : "text-muted-ink"}`}
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {hasFilters && (
              <Link
                href="/search"
                className="inline-block text-sm font-medium text-muted-ink underline hover:no-underline"
              >
                Clear all filters
              </Link>
            )}
          </aside>

          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-3">
              <h1 className="text-lg font-semibold">
                {results.length === 0
                  ? "No results"
                  : `${results.length} ${results.length === 1 ? "result" : "results"}`}
                {q && (
                  <>
                    {" "}
                    for <span className="text-accent">&ldquo;{q}&rdquo;</span>
                  </>
                )}
                {activeCategory && !q && <> in {activeCategory.name.toLowerCase()}</>}
              </h1>
              <p className="text-sm text-muted-ink">
                Sorted by {SORTS.find((s) => s.key === sort)?.label.toLowerCase()}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-10 text-center">
                <p className="text-base font-medium">Nothing matched those filters.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-ink">
                  Try a shorter search term, a wider price range, or clear the category filter.
                  The demo catalog holds twelve products in total.
                </p>
                <Link
                  href="/search"
                  className="mt-5 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"
                >
                  Clear all filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
