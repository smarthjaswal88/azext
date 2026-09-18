import Link from "next/link";
import { FilterPanel, type RawParams } from "@/components/filter-panel";
import { FilterIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { SortSelect } from "@/components/sort-select";
import { parseDollarsToCents } from "@/lib/format";
import { SORT_OPTIONS } from "@/lib/sort";
import type { CategoryId, SortKey } from "@/lib/types";
import { getCategories, getPriceBounds, searchProducts } from "@/server/catalog";

export const metadata = { title: "Search" };

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
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
  const sort = (SORT_OPTIONS.find((s) => s.key === rawSort)?.key ?? "featured") as SortKey;

  const minText = one(params, "min");
  const maxText = one(params, "max");
  const minPriceCents = parseDollarsToCents(minText);
  const maxPriceCents = parseDollarsToCents(maxText);

  const results = await searchProducts({ q, category, minPriceCents, maxPriceCents, sort });

  const activeCategory = categories.find((c) => c.id === category);
  const hasFilters = Boolean(
    q || category || minPriceCents !== undefined || maxPriceCents !== undefined,
  );

  const filterProps = {
    params,
    categories,
    category,
    q,
    sort,
    minText,
    maxText,
    bounds,
    hasFilters,
  };

  return (
    <>
      <SiteHeader defaultQuery={q ?? ""} />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-3 sm:px-4">
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]">
          {/* Desktop rail */}
          <aside className="hidden rounded-lg border border-border-subtle bg-surface p-3 lg:block lg:self-start">
            <FilterPanel idPrefix="desktop" {...filterProps} />
          </aside>

          <section className="min-w-0">
            <div className="mb-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h1 className="text-sm sm:text-base">
                  <span className="font-bold">
                    {results.length === 0
                      ? "No results"
                      : `${results.length} ${results.length === 1 ? "result" : "results"}`}
                  </span>
                  {q && (
                    <>
                      {" "}
                      for <span className="text-sale">&ldquo;{q}&rdquo;</span>
                    </>
                  )}
                  {activeCategory && !q && <> in {activeCategory.name.toLowerCase()}</>}
                </h1>
                <SortSelect value={sort} />
              </div>

              {/* Mobile filters: same panel, inside a disclosure so it does not
                  push the results off the screen. */}
              <details className="mt-2.5 border-t border-border-subtle pt-2.5 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                  <FilterIcon size={17} />
                  Filters
                  {hasFilters && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">
                      on
                    </span>
                  )}
                </summary>
                <div className="pt-3">
                  <FilterPanel idPrefix="mobile" {...filterProps} />
                </div>
              </details>
            </div>

            {results.length === 0 ? (
              <div className="rounded-lg border border-border-subtle bg-surface p-10 text-center">
                <p className="text-base font-semibold">Nothing matched those filters.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                  Try a shorter search term, a wider price range, or clear the category filter.
                  This catalog holds twelve products in total.
                </p>
                <Link
                  href="/search"
                  className="mt-5 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
                >
                  Clear all filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
